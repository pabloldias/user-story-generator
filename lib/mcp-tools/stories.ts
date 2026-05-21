import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

export const listStoriesSchema = z.object({
  requirement_id: z.string().uuid().optional().describe("Filter by requirement UUID"),
  status: z
    .enum(["draft", "under_review", "approved", "needs_changes", "exported"])
    .optional()
    .describe("Filter by status"),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).optional().describe("Filter by priority"),
});

export const getStorySchema = z.object({
  story_id: z.string().uuid().describe("UUID of the user story"),
});

export const approveStorySchema = z.object({
  story_id: z.string().uuid().describe("UUID of the story to approve"),
});

export const rejectStorySchema = z.object({
  story_id: z.string().uuid().describe("UUID of the story to reject"),
  feedback: z.string().min(10).max(5000).describe("Rejection feedback"),
});

export const updateStorySchema = z.object({
  story_id: z.string().uuid().describe("UUID of the story to update"),
  title: z.string().min(1).max(500).optional(),
  story_body: z.string().min(1).optional(),
  acceptance_criteria: z.string().min(1).optional(),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  story_points: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(8), z.literal(13)])
    .optional(),
  labels: z.array(z.string()).optional(),
  status: z.enum(["draft", "under_review", "approved", "needs_changes", "exported"]).optional(),
});

export async function listStories(args: z.infer<typeof listStoriesSchema>) {
  let query = getAdminClient()
    .from("user_stories")
    .select("*")
    .order("created_at", { ascending: false });
  if (args.requirement_id) query = query.eq("requirement_id", args.requirement_id);
  if (args.status) query = query.eq("status", args.status);
  if (args.priority) query = query.eq("priority", args.priority);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getStory(args: z.infer<typeof getStorySchema>) {
  const { data, error } = await getAdminClient()
    .from("user_stories")
    .select("*")
    .eq("id", args.story_id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function approveStory(args: z.infer<typeof approveStorySchema>) {
  const { data, error } = await getAdminClient()
    .from("user_stories")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", args.story_id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function rejectStory(args: z.infer<typeof rejectStorySchema>) {
  const supabase = getAdminClient();
  const { data: story, error: storyError } = await supabase
    .from("user_stories")
    .update({ status: "needs_changes", updated_at: new Date().toISOString() })
    .eq("id", args.story_id)
    .select("requirement_id")
    .single();
  if (storyError || !story) throw new Error(storyError?.message ?? "Story not found");
  await supabase
    .from("requirements")
    .update({ rejection_feedback: args.feedback })
    .eq("id", (story as { requirement_id: string }).requirement_id);
  return {
    story_id: args.story_id,
    requirement_id: (story as { requirement_id: string }).requirement_id,
    status: "needs_changes",
    feedback: args.feedback,
  };
}

export async function updateStory(args: z.infer<typeof updateStorySchema>) {
  const { story_id, ...fields } = args;
  const { data, error } = await getAdminClient()
    .from("user_stories")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", story_id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
