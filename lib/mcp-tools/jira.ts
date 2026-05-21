import { z } from "zod";
import { buildJiraPayload, createJiraIssue, getJiraProjects } from "@/lib/jira";
import { createClient } from "@supabase/supabase-js";
import type { UserStory } from "@/types";

function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

export const exportToJiraSchema = z.object({
  story_id: z.string().uuid().describe("UUID of the approved story to export"),
  dry_run: z
    .boolean()
    .optional()
    .default(false)
    .describe("Preview payload without creating the issue"),
});

export const listJiraProjectsSchema = z.object({});

export async function exportToJira(args: z.infer<typeof exportToJiraSchema>) {
  const supabase = getAdminClient();
  const { data: story, error } = await supabase
    .from("user_stories")
    .select("*")
    .eq("id", args.story_id)
    .single();
  if (error || !story) throw new Error("Story not found");

  const typedStory = story as UserStory;
  if (!args.dry_run && typedStory.status !== "approved") {
    throw new Error(
      `Story must be 'approved' before exporting. Current status: '${typedStory.status}'.`,
    );
  }
  if (!args.dry_run && typedStory.jira_issue_key) {
    throw new Error(`Story already exported as ${typedStory.jira_issue_key}.`);
  }

  const payload = buildJiraPayload(typedStory);
  const result = await createJiraIssue(payload, args.dry_run ?? false);

  if (args.dry_run) {
    return { dry_run: true, payload: result };
  }

  const jiraIssue = result as { key: string };
  await supabase
    .from("user_stories")
    .update({
      jira_issue_key: jiraIssue.key,
      status: "exported",
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.story_id);

  return { jira_issue_key: jiraIssue.key, dry_run: false };
}

export async function listJiraProjects(_args: z.infer<typeof listJiraProjectsSchema>) {
  const projects = await getJiraProjects();
  return { projects };
}
