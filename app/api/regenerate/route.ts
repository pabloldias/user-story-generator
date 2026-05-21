import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/mcp-auth";
import { runPipeline } from "@/lib/pipeline";
import { validateStory } from "@/lib/guardrails";
import { LLMError } from "@/lib/llm";
import type { GenerateResponse, UserStory } from "@/types";

// ─── Request schema ───────────────────────────────────────────────────────────

const RegenerateRequestSchema = z.object({
  requirement_id: z.string().uuid("requirement_id must be a valid UUID."),
  feedback: z
    .string()
    .min(10, "feedback must be at least 10 characters.")
    .max(5_000, "feedback must be at most 5000 characters."),
});

// ─── POST /api/regenerate ─────────────────────────────────────────────────────

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

  const parsed = RegenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { requirement_id, feedback } = parsed.data;

  // ── 3. Load the requirement (and verify ownership) ────────────────────────
  const { data: requirement, error: reqFetchError } = await supabase
    .from("requirements")
    .select("*")
    .eq("id", requirement_id)
    .eq("user_id", user.id)
    .single();

  if (reqFetchError || !requirement) {
    return NextResponse.json({ error: "Requirement not found." }, { status: 404 });
  }

  // ── 4. Persist feedback & set status back to processing ───────────────────
  const { error: updateError } = await supabase
    .from("requirements")
    .update({
      rejection_feedback: feedback,
      status: "processing",
    })
    .eq("id", requirement_id);

  if (updateError) {
    console.error("[regenerate] Failed to update requirement:", updateError);
    return NextResponse.json({ error: "Failed to update requirement." }, { status: 500 });
  }

  // ── 5. Delete existing stories for this requirement ───────────────────────
  const { error: deleteError } = await supabase
    .from("user_stories")
    .delete()
    .eq("requirement_id", requirement_id);

  if (deleteError) {
    console.error("[regenerate] Failed to delete old stories:", deleteError);
    return NextResponse.json({ error: "Failed to clear previous stories." }, { status: 500 });
  }

  // ── 6. Build enriched input: original + reviewer feedback ─────────────────
  const enrichedInput = `${requirement.raw_input}

---
REVIEWER FEEDBACK (must be addressed in the generated stories):
${feedback}`;

  try {
    // ── 7. Re-run AI pipeline (returns 1–5 PipelineResults) ───────────────
    const pipelineResults = await runPipeline(enrichedInput);

    // ── 8. Validate, insert, and log each story ────────────────────────────
    const insertedStories: UserStory[] = [];
    const allWarnings: string[] = [];

    for (const pipelineResult of pipelineResults) {
      const guardrail = validateStory(pipelineResult);

      const storyStatus = guardrail.passed ? "draft" : "needs_changes";
      const mergedFlags = [...new Set([...pipelineResult.flags, ...guardrail.flags])];

      const { data: story, error: storyInsertError } = await supabase
        .from("user_stories")
        .insert({
          requirement_id,
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
        console.error("[regenerate] Failed to insert user story:", storyInsertError);
        throw new Error("Failed to store regenerated story.");
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

    // ── 9. Mark requirement as completed ───────────────────────────────────
    await supabase
      .from("requirements")
      .update({ status: "completed" })
      .eq("id", requirement_id);

    // ── 10. Return structured payload ──────────────────────────────────────
    const response: GenerateResponse = {
      requirement_id,
      stories: insertedStories,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    // ── Error path: mark requirement as failed ──────────────────────────────
    await supabase
      .from("requirements")
      .update({ status: "failed" })
      .eq("id", requirement_id);

    if (err instanceof LLMError) {
      console.error("[regenerate] LLM error:", err.message, err.cause);
      return NextResponse.json(
        { error: "AI regeneration failed.", detail: err.message },
        { status: 502 },
      );
    }

    console.error("[regenerate] Unexpected error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
