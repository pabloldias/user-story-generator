import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/mcp-auth";
import { runPipeline } from "@/lib/pipeline";
import { validateStory } from "@/lib/guardrails";
import { LLMError } from "@/lib/llm";
import type { GenerateResponse, UserStory } from "@/types";

// ─── Request schema ───────────────────────────────────────────────────────────

const GenerateRequestSchema = z.object({
  project_id: z.string().uuid("project_id must be a valid UUID."),
  raw_input: z.string().min(10, "raw_input must be at least 10 characters.").max(10_000),
});

// ─── POST /api/generate ───────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Authenticate ────────────────────────────────────────────────────────
  const { supabase, user, error: authError } = await authenticateRequest(req);

  if (authError || !user || !supabase) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── 2. Parse and validate request body ────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { project_id, raw_input } = parsed.data;

  // ── 3. Insert requirement record (status: processing) ─────────────────────
  const { data: requirement, error: reqInsertError } = await supabase
    .from("requirements")
    .insert({
      project_id,
      user_id: user.id,
      raw_input,
      source_type: "text",
      status: "processing",
    })
    .select()
    .single();

  if (reqInsertError || !requirement) {
    console.error("[generate] Failed to insert requirement:", reqInsertError);
    return NextResponse.json({ error: "Failed to save requirement." }, { status: 500 });
  }

  const requirementId: string = requirement.id;

  try {
    // ── 4. Run AI pipeline (returns 1–5 PipelineResults) ───────────────────
    const pipelineResults = await runPipeline(raw_input);

    // ── 5. Validate, insert, and log each story ─────────────────────────────
    const insertedStories: UserStory[] = [];
    const allWarnings: string[] = [];

    for (const pipelineResult of pipelineResults) {
      const guardrail = validateStory(pipelineResult);

      const storyStatus = guardrail.passed ? "draft" : "needs_changes";
      const mergedFlags = [...new Set([...pipelineResult.flags, ...guardrail.flags])];

      const { data: story, error: storyInsertError } = await supabase
        .from("user_stories")
        .insert({
          requirement_id: requirementId,
          title: pipelineResult.title,
          story_body: pipelineResult.story_body,
          acceptance_criteria: pipelineResult.acceptance_criteria,
          priority: pipelineResult.priority,
          story_points: pipelineResult.story_points,
          labels: pipelineResult.labels,
          confidence_score: pipelineResult.confidence_score,
          status: storyStatus,
          flags: mergedFlags,
          jira_issue_key: null,
        })
        .select()
        .single();

      if (storyInsertError || !story) {
        console.error("[generate] Failed to insert user story:", storyInsertError);
        throw new Error("Failed to store generated story.");
      }

      if (guardrail.checks.length > 0) {
        await supabase.from("guardrail_logs").insert(
          guardrail.checks.map((c) => ({
            story_id: (story as { id: string }).id,
            rule: c.rule,
            passed: c.passed,
            details: c.details,
          })),
        );
      }

      insertedStories.push(story as UserStory);
      if (guardrail.warnings.length > 0) {
        allWarnings.push(...guardrail.warnings);
      }
    }

    // ── 6. Mark requirement as completed ───────────────────────────────────
    await supabase
      .from("requirements")
      .update({ status: "completed" })
      .eq("id", requirementId);

    // ── 7. Return structured payload ────────────────────────────────────────
    const response: GenerateResponse = {
      requirement_id: requirementId,
      stories: insertedStories,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    // ── Error path: mark requirement as failed ──────────────────────────────
    await supabase
      .from("requirements")
      .update({ status: "failed" })
      .eq("id", requirementId);

    if (err instanceof LLMError) {
      console.error("[generate] LLM error:", err.message, err.cause);
      return NextResponse.json(
        { error: "AI generation failed.", detail: err.message },
        { status: 502 },
      );
    }

    console.error("[generate] Unexpected error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
