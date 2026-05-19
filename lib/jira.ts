import axios from "axios";

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY;

function getAuthHeader() {
  const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  return `Basic ${credentials}`;
}

export interface JiraIssuePayload {
  summary: string;
  description: string;
  priority: string;
  labels: string[];
  storyPoints?: number;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
}

/**
 * Creates a Jira issue from an approved user story.
 * Returns the created issue key (e.g. "PROJ-123").
 */
export async function createJiraIssue(
  payload: JiraIssuePayload,
  dryRun = false,
): Promise<JiraIssue | JiraIssuePayload> {
  if (dryRun) {
    console.log("[Jira dry-run] Would create issue:", payload);
    return payload;
  }

  if (!JIRA_BASE_URL || !JIRA_API_TOKEN || !JIRA_EMAIL || !JIRA_PROJECT_KEY) {
    throw new Error("Missing Jira environment variables.");
  }

  const body = {
    fields: {
      project: { key: JIRA_PROJECT_KEY },
      summary: payload.summary,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: payload.description }],
          },
        ],
      },
      issuetype: { name: "Story" },
      priority: { name: payload.priority },
      labels: payload.labels,
      ...(payload.storyPoints ? { story_points: payload.storyPoints } : {}),
    },
  };

  const response = await axios.post<JiraIssue>(`${JIRA_BASE_URL}/rest/api/3/issue`, body, {
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  });

  return response.data;
}

/**
 * Fetches available Jira projects for project configuration UI.
 */
export async function getJiraProjects() {
  if (!JIRA_BASE_URL || !JIRA_API_TOKEN || !JIRA_EMAIL) {
    throw new Error("Missing Jira environment variables.");
  }

  const response = await axios.get(`${JIRA_BASE_URL}/rest/api/3/project`, {
    headers: { Authorization: getAuthHeader() },
  });

  return response.data;
}
