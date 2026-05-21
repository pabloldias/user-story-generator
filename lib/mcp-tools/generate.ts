import { z } from "zod";
import { runPipeline } from "@/lib/pipeline";
import { validateStory } from "@/lib/guardrails";
import { createClient } from "@supabase/supabase-js";
import type { UserStory } from "@/types";

function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

export const generateStoriesSchema = z.object({
  project_id: z.string().uuid().describe("UUID of the project"),
  raw_input: z.string().min(10).max(10000).describe("Raw requirement text (≥10 characters)"),
});

export const regenerateStoriesSchema = z.object({
  requirement_id: z.string().uuid().describe("UUID of the existing requirement to regenerate"),
  feedback: z.string().min(10).max(5000).describe("Feedback on what to improve (≥10 characters)"),
});

export async function generateStories(args: z.infer<typeof generateStoriesSchema>) {
  const supabase = getAdminClient();

  // Find the project owner for user_id
  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", args.project_id)
    .single();
  const user_id = (project as { user_id: string } | null)?.user_id ?? "mcp-service";

  const { data: requirement, error: reqError } = await supabase
    .from("requirements")
    .insert({
      project_id: args.project_id,
      user_id,
      raw_input: args.raw_input,
      source_type: "text",
      status: "processing",
    })
    .select()
    .single();
  if (reqError || !requirement)
    throw new Error(reqError?.message ?? "Failed to create requirement");

  const requirementId: string = (requirement as { id: string }).id;

  try {
    const pipelineResults = await runPipeline(args.raw_input);
    const insertedStories: UserStory[] = [];
    const allWarnings: string[] = [];

    for (const result of pipelineResults) {
      const guardrail = validateStory(result);
      const storyStatus = guardrail.passed ? "draft" : "needs_changes";
      const mergedFlags = [...new Set([...result.flags, ...guardrail.flags])];

      const { data: story, error: storyError } = await supabase
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
          flags: mergedFlags,
          jira_issue_key: null,
        })
        .select()
        .single();
      if (storyError || !story) throw new Error("Failed to store story");
      insertedStories.push(story as UserStory);
      if (guardrail.warnings.length > 0) allWarnings.push(...guardrail.warnings);
    }

    await supabase.from("requirements").update({ status: "completed" }).eq("id", requirementId);
    return {
      requirement_id: requirementId,
      stories: insertedStories,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };
  } catch (err) {
    await supabase.from("requirements").update({ status: "failed" }).eq("id", requirementId);
    throw err;
  }
}

export async function regenerateStories(args: z.infer<typeof regenerateStoriesSchema>) {
  const supabase = getAdminClient();

  const { data: requirement, error: reqError } = await supabase
    .from("requirements")
    .select("*")
    .eq("id", args.requirement_id)
    .single();
  if (reqError || !requirement) throw new Error("Requirement not found");

  await supabase
    .from("requirements")
    .update({ rejection_feedback: args.feedback, status: "processing" })
    .eq("id", args.requirement_id);
  await supabase.from("user_stories").delete().eq("requirement_id", args.requirement_id);

  const req = requirement as { raw_input: string };

  try {
    const pipelineResults = await runPipeline(req.raw_input);
    const insertedStories: UserStory[] = [];
    const allWarnings: string[] = [];

    for (const result of pipelineResults) {
      const guardrail = validateStory(result);
      const storyStatus = guardrail.passed ? "draft" : "needs_changes";
      const mergedFlags = [...new Set([...result.flags, ...guardrail.flags])];

      const { data: story, error: storyError } = await supabase
        .from("user_stories")
        .insert({
          requirement_id: args.requirement_id,
          title: result.title,
          story_body: result.story_body,
          acceptance_criteria: result.acceptance_criteria,
          priority: result.priority,
          story_points: result.story_points,
          labels: result.labels,
          confidence_score: result.confidence_score,
          status: storyStatus,
          flags: mergedFlags,
          jira_issue_key: null,
        })
        .select()
        .single();
      if (storyError || !story) throw new Error("Failed to store story");
      insertedStories.push(story as UserStory);
      if (guardrail.warnings.length > 0) allWarnings.push(...guardrail.warnings);
    }

    await supabase
      .from("requirements")
      .update({ status: "completed" })
      .eq("id", args.requirement_id);
    return {
      requirement_id: args.requirement_id,
      stories: insertedStories,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };
  } catch (err) {
    await supabase.from("requirements").update({ status: "failed" }).eq("id", args.requirement_id);
    throw err;
  }
}
