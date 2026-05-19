import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractEntities, generateStory, generateAcceptanceCriteria } from "@/lib/pipeline";
import { LLMError } from "@/lib/llm";

/**
 * POST /api/prompt-test
 *
 * Development-only endpoint for testing individual pipeline steps in isolation
 * without going through Supabase auth or persisting any records.
 *
 * Blocked in production via the NODE_ENV guard at the top of the handler.
 *
 * Request body:
 * {
 *   "step": "entity_extraction" | "story_generation" | "acceptance_criteria",
 *   "input": "<raw text for entity_extraction>",
 *   "story_body": "<story text for acceptance_criteria>",
 *   "entities": { actor, goal, value, missing_fields } // for story_generation
 * }
 *
 * Response: the structured output from the chosen step.
 */

const PromptTestSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("entity_extraction"),
    input: z.string().min(1, "input is required for entity_extraction"),
  }),
  z.object({
    step: z.literal("story_generation"),
    entities: z.object({
      actor: z.string().nullable(),
      goal: z.string().nullable(),
      value: z.string().nullable(),
      missing_fields: z.array(z.enum(["actor", "goal", "value"])).default([]),
    }),
  }),
  z.object({
    step: z.literal("acceptance_criteria"),
    story_body: z.string().min(1, "story_body is required for acceptance_criteria"),
  }),
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Guard: dev/test only ────────────────────────────────────────────────────
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is disabled in production." },
      { status: 403 },
    );
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = PromptTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  // ── Run the requested step ──────────────────────────────────────────────────
  try {
    switch (parsed.data.step) {
      case "entity_extraction": {
        const result = await extractEntities(parsed.data.input);
        return NextResponse.json({ step: "entity_extraction", result });
      }

      case "story_generation": {
        const result = await generateStory(parsed.data.entities);
        return NextResponse.json({ step: "story_generation", result });
      }

      case "acceptance_criteria": {
        const result = await generateAcceptanceCriteria(parsed.data.story_body);
        return NextResponse.json({ step: "acceptance_criteria", result });
      }
    }
  } catch (err) {
    if (err instanceof LLMError) {
      return NextResponse.json(
        { error: "LLM call failed.", detail: err.message },
        { status: 502 },
      );
    }
    console.error("[prompt-test] Unexpected error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
