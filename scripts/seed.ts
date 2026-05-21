#!/usr/bin/env npx tsx
/**
 * scripts/seed.ts
 *
 * Populates Supabase with the mock requirements from /mock-data/requirements.json
 * and runs the full AI pipeline for each one, storing generated stories.
 *
 * Prerequisites:
 *   - .env.local must be present and contain NEXT_PUBLIC_SUPABASE_URL,
 *     SUPABASE_SERVICE_ROLE_KEY, REQUESTY_API_KEY, REQUESTY_BASE_URL,
 *     REQUESTY_MODEL, and SEED_USER_EMAIL / SEED_USER_PASSWORD.
 *
 * Usage:
 *   npx tsx scripts/seed.ts [--dry-run]
 *
 * Flags:
 *   --dry-run   Run the pipeline and log results without writing to the database.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";

// ─── Load env ─────────────────────────────────────────────────────────────────
config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SEED_EMAIL = process.env.SEED_USER_EMAIL;
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD;
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "❌  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local"
  );
  process.exit(1);
}

if (!SEED_EMAIL || !SEED_PASSWORD) {
  console.error(
    "❌  SEED_USER_EMAIL and SEED_USER_PASSWORD must be set in .env.local\n" +
    "    Create a test user in Supabase Auth and set these vars to its credentials."
  );
  process.exit(1);
}

// ─── Supabase admin client (bypasses RLS) ─────────────────────────────────────
const adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Mock data ────────────────────────────────────────────────────────────────
interface MockRequirement {
  id: string;
  type: string;
  description: string;
  raw_input: string;
}

const mockRequirements: MockRequirement[] = JSON.parse(
  readFileSync(resolve(process.cwd(), "mock-data/requirements.json"), "utf-8")
);

// ─── Pipeline (re-implemented inline to avoid Next.js module resolution) ─────
// We import the compiled pipeline directly. tsx handles TS → JS on the fly.
// Adjust the import if you move this script.
import("../lib/pipeline").then(async ({ runPipeline }) => {
  await import("../lib/guardrails").then(async ({ validateStory }) => {
    await main(runPipeline, validateStory);
  });
});

async function main(
  runPipeline: (input: string) => Promise<import("../lib/schemas").PipelineResult[]>,
  validateStory: (
    story: import("../lib/schemas").PipelineResult
  ) => import("../lib/guardrails").GuardrailResult
) {
  console.log(`\n🌱  User Story Generator — Seed Script`);
  console.log(`   Mode     : ${DRY_RUN ? "DRY RUN (no DB writes)" : "LIVE"}`);
  console.log(`   Inputs   : ${mockRequirements.length}`);
  console.log(`   User     : ${SEED_EMAIL}\n`);

  // ── 1. Resolve the seed user's UUID ─────────────────────────────────────
  const { data: userList, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error("❌  Failed to list users:", listError.message);
    process.exit(1);
  }

  const seedUser = userList.users.find((u) => u.email === SEED_EMAIL);
  if (!seedUser) {
    console.error(
      `❌  No Supabase Auth user found with email "${SEED_EMAIL}".\n` +
      "    Create the user in Supabase Dashboard → Authentication → Users first."
    );
    process.exit(1);
  }

  const userId = seedUser.id;
  console.log(`✅  Seed user resolved: ${userId}\n`);

  // ── 2. Ensure a seed project exists ─────────────────────────────────────
  let projectId: string;

  const { data: existingProject } = await adminClient
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "Seed Project")
    .maybeSingle();

  if (existingProject) {
    projectId = existingProject.id as string;
    console.log(`♻️   Reusing existing seed project: ${projectId}`);
  } else if (!DRY_RUN) {
    const { data: newProject, error: projectError } = await adminClient
      .from("projects")
      .insert({
        user_id: userId,
        name: "Seed Project",
        description: "Auto-generated project for mock data seeding.",
      })
      .select("id")
      .single();

    if (projectError || !newProject) {
      console.error("❌  Failed to create seed project:", projectError?.message);
      process.exit(1);
    }
    projectId = newProject.id as string;
    console.log(`✅  Created seed project: ${projectId}`);
  } else {
    projectId = "dry-run-project-id";
    console.log(`🔍  DRY RUN — skipping project creation`);
  }

  console.log();

  // ── 3. Process each mock requirement ────────────────────────────────────
  let passed = 0;
  let warned = 0;
  let failed = 0;

  for (const mock of mockRequirements) {
    const prefix = `[${mock.id}] ${mock.description}`;
    console.log(`⏳  ${prefix}`);
    console.log(`    Type : ${mock.type}`);
    console.log(`    Input: ${mock.raw_input.slice(0, 80).replace(/\n/g, " ")}…`);

    try {
      // Insert requirement record
      let requirementId: string;

      if (!DRY_RUN) {
        const { data: req, error: reqError } = await adminClient
          .from("requirements")
          .insert({
            project_id: projectId,
            user_id: userId,
            raw_input: mock.raw_input,
            source_type: "text",
            status: "processing",
          })
          .select("id")
          .single();

        if (reqError || !req) {
          throw new Error(`DB insert failed: ${reqError?.message}`);
        }
        requirementId = req.id as string;
      } else {
        requirementId = `dry-run-req-${mock.id}`;
      }

      // Run pipeline — may return multiple stories for complex requirements
      const results = await runPipeline(mock.raw_input);

      console.log(`    Stories: ${results.length}`);

      let reqHasWarning = false;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const storyLabel = results.length > 1 ? ` [${i + 1}/${results.length}]` : "";

        // Run guardrails
        const guardrail = validateStory(result);

        const storyStatus = guardrail.passed ? "draft" : "needs_changes";
        const mergedFlags = [...new Set([...result.flags, ...guardrail.flags])];

        console.log(`    Title${storyLabel}  : ${result.title}`);
        console.log(`    Status${storyLabel} : ${storyStatus}  |  Confidence: ${result.confidence_score.toFixed(2)}`);
        console.log(`    Flags${storyLabel}  : ${mergedFlags.length > 0 ? mergedFlags.join(", ") : "none"}`);

        if (guardrail.warnings.length > 0) {
          reqHasWarning = true;
          for (const w of guardrail.warnings) {
            console.log(`    ⚠️   ${w}`);
          }
        }

        if (!DRY_RUN) {
          // Insert story
          const { data: story, error: storyError } = await adminClient
            .from("user_stories")
            .insert({
              requirement_id: requirementId,
              title: result.title,
              story_body: result.story_body,
              acceptance_criteria: result.acceptance_criteria,
              priority: result.priority,
              story_points: result.story_points,
              labels: result.labels,
              confidence_score: result.confidence_score,
              status: storyStatus,
              flags: mergedFlags.length > 0 ? mergedFlags : null,
              jira_issue_key: null,
            })
            .select("id")
            .single();

          if (storyError || !story) {
            throw new Error(`Story insert failed: ${storyError?.message}`);
          }

          // Insert guardrail logs
          if (guardrail.checks.length > 0) {
            await adminClient.from("guardrail_logs").insert(
              guardrail.checks.map((c) => ({
                story_id: (story as { id: string }).id,
                rule: c.rule,
                passed: c.passed,
                details: c.details,
              }))
            );
          }
        }
      }

      if (reqHasWarning) {
        warned++;
      } else {
        passed++;
      }

      if (!DRY_RUN) {
        // Mark requirement completed
        await adminClient
          .from("requirements")
          .update({ status: "completed" })
          .eq("id", requirementId);
      }

      console.log(`    ✅  Done\n`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`    ❌  FAILED: ${msg}\n`);

      if (!DRY_RUN) {
        // Best-effort: mark requirement as failed if we can find it
        await adminClient
          .from("requirements")
          .update({ status: "failed" })
          .eq("project_id", projectId)
          .eq("raw_input", mock.raw_input)
          .eq("user_id", userId);
      }
    }
  }

  // ── 4. Summary ─────────────────────────────────────────────────────────
  console.log("─".repeat(60));
  console.log(`📊  Seed Summary`);
  console.log(`    Total   : ${mockRequirements.length}`);
  console.log(`    ✅  Clean  : ${passed}`);
  console.log(`    ⚠️   Warned : ${warned}`);
  console.log(`    ❌  Failed : ${failed}`);
  if (DRY_RUN) {
    console.log(`\n    DRY RUN — no records were written to the database.`);
  }
  console.log();
}
