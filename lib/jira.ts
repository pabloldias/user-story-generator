import axios, { AxiosError } from "axios";
import type { UserStory } from "@/types";

// ─── Environment ──────────────────────────────────────────────────────────────

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY;

/**
 * The Jira custom field ID used for story points.
 * Set JIRA_STORY_POINTS_FIELD (e.g. "customfield_10016") to enable story-point syncing.
 * If the env var is not set, story points are intentionally omitted from the Jira payload
 * to avoid 400 errors when the field is not on the project's create screen.
 */
const JIRA_STORY_POINTS_FIELD = process.env.JIRA_STORY_POINTS_FIELD ?? null;

// ─── Error class ──────────────────────────────────────────────────────────────

export class JiraError extends Error {
  public readonly statusCode?: number;
  public readonly jiraErrors?: Record<string, string>;
  public readonly jiraErrorMessages?: string[];

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      jiraErrors?: Record<string, string>;
      jiraErrorMessages?: string[];
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "JiraError";
    this.statusCode = options?.statusCode;
    this.jiraErrors = options?.jiraErrors;
    this.jiraErrorMessages = options?.jiraErrorMessages;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getAuthHeader(): string {
  const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  return `Basic ${credentials}`;
}

function assertEnvVars(): void {
  if (!JIRA_BASE_URL || !JIRA_API_TOKEN || !JIRA_EMAIL || !JIRA_PROJECT_KEY) {
    throw new JiraError(
      "Missing required Jira environment variables: JIRA_BASE_URL, JIRA_API_TOKEN, JIRA_EMAIL, JIRA_PROJECT_KEY.",
    );
  }
}

/**
 * Normalises an Axios error thrown by the Jira API into a `JiraError`.
 */
function handleAxiosError(err: unknown, context: string): never {
  if (err instanceof AxiosError && err.response) {
    const { status, data } = err.response as {
      status: number;
      data: { errors?: Record<string, string>; errorMessages?: string[] };
    };

    const jiraErrors = data?.errors ?? {};
    const jiraErrorMessages = data?.errorMessages ?? [];

    const humanMessage =
      Object.values(jiraErrors).join("; ") ||
      jiraErrorMessages.join("; ") ||
      `Jira API returned HTTP ${status}`;

    throw new JiraError(`${context}: ${humanMessage}`, {
      statusCode: status,
      jiraErrors,
      jiraErrorMessages,
      cause: err,
    });
  }
  throw new JiraError(`${context}: Unexpected error`, { cause: err });
}

// ─── Public types ─────────────────────────────────────────────────────────────

/** The raw Jira issue payload sent to POST /rest/api/3/issue. */
export interface JiraIssuePayload {
  summary: string;
  description: string;
  priority: string;
  labels: string[];
  storyPoints?: number;
}

/** Minimal shape of a successfully created Jira issue response. */
export interface JiraIssue {
  id: string;
  key: string;
  self: string;
}

/** Shape returned by GET /rest/api/3/project. */
export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  self: string;
}

// ─── Payload builder ──────────────────────────────────────────────────────────

/**
 * Maps internal Priority values to Jira's default priority scheme names.
 * Jira Cloud default priorities: Highest, High, Medium, Low, Lowest.
 */
function toJiraPriority(priority: UserStory["priority"]): string {
  const map: Record<UserStory["priority"], string> = {
    Critical: "Highest",
    High: "High",
    Medium: "Medium",
    Low: "Low",
  };
  return map[priority] ?? "Medium";
}

/**
 * Converts an app `UserStory` record into a `JiraIssuePayload`.
 *
 * Field mapping per the implementation plan:
 *  title                        → summary
 *  story_body + acceptance_criteria → description (ADF)
 *  priority                     → priority.name (mapped to Jira scheme)
 *  labels                       → labels
 *  story_points                 → customfield_10016 (or JIRA_STORY_POINTS_FIELD)
 */
export function buildJiraPayload(story: UserStory): JiraIssuePayload {
  const description = [story.story_body, "", "--- Acceptance Criteria ---", "", story.acceptance_criteria].join("\n");

  return {
    summary: story.title,
    description,
    priority: toJiraPriority(story.priority),
    labels: story.labels,
    storyPoints: story.story_points,
  };
}

/**
 * Converts a `JiraIssuePayload` into the ADF body expected by the Jira v3 API.
 */
function buildAdfDescription(description: string): Record<string, unknown> {
  const paragraphs = description.split("\n").map((line) => ({
    type: "paragraph",
    content: [{ type: "text", text: line || " " }],
  }));

  return {
    type: "doc",
    version: 1,
    content: paragraphs,
  };
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Creates a Jira issue from a `JiraIssuePayload`.
 *
 * Pass `dryRun: true` to preview the request body without actually creating a ticket.
 * Returns the created `JiraIssue` on success, or the payload object in dry-run mode.
 */
export async function createJiraIssue(
  payload: JiraIssuePayload,
  dryRun = false,
): Promise<JiraIssue | JiraIssuePayload> {
  if (dryRun) {
    console.log("[Jira dry-run] Would create issue:", JSON.stringify(payload, null, 2));
    return payload;
  }

  assertEnvVars();

  const body = {
    fields: {
      project: { key: JIRA_PROJECT_KEY },
      summary: payload.summary,
      description: buildAdfDescription(payload.description),
      issuetype: { name: "Story" },
      priority: { name: payload.priority },
      labels: payload.labels,
      ...(JIRA_STORY_POINTS_FIELD != null && payload.storyPoints != null
        ? { [JIRA_STORY_POINTS_FIELD]: payload.storyPoints }
        : {}),
    },
  };

  try {
    const response = await axios.post<JiraIssue>(
      `${JIRA_BASE_URL}/rest/api/3/issue`,
      body,
      {
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );

    return response.data;
  } catch (err) {
    handleAxiosError(err, "createJiraIssue");
  }
}

/**
 * Fetches a single Jira issue by its key (e.g. "PROJ-123").
 */
export async function getJiraIssue(issueKey: string): Promise<Record<string, unknown>> {
  assertEnvVars();

  try {
    const response = await axios.get<Record<string, unknown>>(
      `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}`,
      {
        headers: {
          Authorization: getAuthHeader(),
          Accept: "application/json",
        },
      },
    );

    return response.data;
  } catch (err) {
    handleAxiosError(err, "getJiraIssue");
  }
}

/**
 * Fetches all Jira projects accessible to the configured credentials.
 * Useful for a project-configuration UI that lets users pick a target project.
 */
export async function getJiraProjects(): Promise<JiraProject[]> {
  assertEnvVars();

  try {
    const response = await axios.get<JiraProject[]>(
      `${JIRA_BASE_URL}/rest/api/3/project`,
      {
        headers: {
          Authorization: getAuthHeader(),
          Accept: "application/json",
        },
      },
    );

    return response.data;
  } catch (err) {
    handleAxiosError(err, "getJiraProjects");
  }
}
