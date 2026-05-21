import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/mcp-auth";
import { buildJiraPayload, createJiraIssue, JiraError } from "@/lib/jira";
import type { UserStory, JiraExportResponse } from "@/types";

// ─── Request schema ───────────────────────────────────────────────────────────

const JiraCreateRequestSchema = z.object({
  story_id: z.string().uuid("story_id must be a valid UUID."),
  dry_run: z.boolean().optional().default(false),
});

// ─── POST /api/jira/create ────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Authenticate ──────────────────────────────────────────────────────
  const { supabase, user, error: authError } = await authenticateRequest(req);

  if (authError || !user || !supabase) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── 2. Parse and validate request body ──────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = JiraCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { story_id, dry_run } = parsed.data;

  // ── 3. Fetch story — RLS ensures users can only access their own data ────
  const { data: story, error: fetchError } = await supabase
    .from("user_stories")
    .select("*")
    .eq("id", story_id)
    .single();

  if (fetchError || !story) {
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  }

  const typedStory = story as UserStory;

  // ── 4. Guard: only approved stories may be exported ─────────────────────
  if (!dry_run && typedStory.status !== "approved") {
    return NextResponse.json(
      {
        error: `Story must be in 'approved' status before exporting to Jira. Current status: '${typedStory.status}'.`,
      },
      { status: 409 },
    );
  }

  // ── 5. Guard: prevent duplicate export ──────────────────────────────────
  if (!dry_run && typedStory.jira_issue_key) {
    return NextResponse.json(
      {
        error: `Story has already been exported to Jira as ${typedStory.jira_issue_key}.`,
        jira_issue_key: typedStory.jira_issue_key,
      },
      { status: 409 },
    );
  }

  // ── 6. Build payload ─────────────────────────────────────────────────────
  const payload = buildJiraPayload(typedStory);

  // ── 7. Call Jira API (or dry-run) ────────────────────────────────────────
  try {
    const result = await createJiraIssue(payload, dry_run);

    // Dry-run: return the preview payload without persisting anything
    if (dry_run) {
      const response: JiraExportResponse = {
        dry_run: true,
        payload: result as unknown as Record<string, unknown>,
      };
      return NextResponse.json(response, { status: 200 });
    }

    // Live run: extract the issue key from the Jira response
    const jiraIssue = result as { id: string; key: string; self: string };
    const jiraIssueKey = jiraIssue.key;

    // ── 8. Persist jira_issue_key + update story status ──────────────────
    const { error: updateError } = await supabase
      .from("user_stories")
      .update({
        jira_issue_key: jiraIssueKey,
        status: "exported",
        updated_at: new Date().toISOString(),
      })
      .eq("id", story_id);

    if (updateError) {
      // Issue was created in Jira but we failed to persist the key.
      // Return 207 Multi-Status so the caller knows the ticket exists.
      console.error("[jira/create] Failed to update story record:", updateError);
      return NextResponse.json(
        {
          warning:
            "Jira issue was created but the issue key could not be saved to the database. Please update the story manually.",
          jira_issue_key: jiraIssueKey,
          dry_run: false,
        } satisfies JiraExportResponse,
        { status: 207 },
      );
    }

    const response: JiraExportResponse = {
      jira_issue_key: jiraIssueKey,
      dry_run: false,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    if (err instanceof JiraError) {
      console.error("[jira/create] Jira API error:", err.message, {
        statusCode: err.statusCode,
        jiraErrors: err.jiraErrors,
        jiraErrorMessages: err.jiraErrorMessages,
      });

      // Map Jira HTTP errors to appropriate response codes
      const status =
        err.statusCode === 401 || err.statusCode === 403
          ? 502 // credentials / permission problem — surface as upstream error
          : err.statusCode === 400
            ? 422 // field-level validation issue
            : 502;

      return NextResponse.json(
        {
          error: "Jira API error.",
          detail: err.message,
          ...(err.jiraErrors && Object.keys(err.jiraErrors).length > 0
            ? { field_errors: err.jiraErrors }
            : {}),
        },
        { status },
      );
    }

    console.error("[jira/create] Unexpected error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
