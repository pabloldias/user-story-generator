import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/mcp-auth";
import { getJiraProjects, JiraError } from "@/lib/jira";

// ─── GET /api/jira/projects ───────────────────────────────────────────────────

/**
 * Returns the list of Jira projects available under the configured credentials.
 * Used by the project-configuration UI to let users pick a target project key.
 *
 * Response shape: { projects: JiraProject[] }
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── 1. Authenticate ──────────────────────────────────────────────────────
  const { user, error: authError } = await authenticateRequest(req);

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── 2. Fetch projects from Jira ──────────────────────────────────────────
  try {
    const projects = await getJiraProjects();

    return NextResponse.json({ projects }, { status: 200 });
  } catch (err) {
    if (err instanceof JiraError) {
      console.error("[jira/projects] Jira API error:", err.message, {
        statusCode: err.statusCode,
      });

      const status =
        err.statusCode === 401 || err.statusCode === 403
          ? 502
          : err.statusCode === 404
            ? 502
            : 502;

      return NextResponse.json(
        { error: "Jira API error.", detail: err.message },
        { status },
      );
    }

    console.error("[jira/projects] Unexpected error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
