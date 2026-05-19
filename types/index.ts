// ─── Database entity types ────────────────────────────────────────────────────

export type StoryStatus = "draft" | "under_review" | "approved" | "needs_changes" | "exported";
export type Priority = "Low" | "Medium" | "High" | "Critical";
export type StoryPoints = 1 | 2 | 3 | 5 | 8 | 13;

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Requirement {
  id: string;
  project_id: string;
  user_id: string;
  raw_input: string;
  source_type: "text" | "document" | "email";
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
}

export interface UserStory {
  id: string;
  requirement_id: string;
  title: string;
  story_body: string;
  acceptance_criteria: string;
  priority: Priority;
  story_points: StoryPoints;
  labels: string[];
  confidence_score: number;
  status: StoryStatus;
  jira_issue_key: string | null;
  flags: string[] | null;
  created_at: string;
  updated_at: string;
}

// ─── API request / response shapes ───────────────────────────────────────────

export interface GenerateRequest {
  project_id: string;
  raw_input: string;
}

export interface GenerateResponse {
  requirement_id: string;
  stories: UserStory[];
  warnings?: string[];
}

export interface JiraExportRequest {
  story_id: string;
  dry_run?: boolean;
}

export interface JiraExportResponse {
  jira_issue_key?: string;
  dry_run: boolean;
  payload?: Record<string, unknown>;
  /** Present when the Jira issue was created but persisting the key to the DB failed. */
  warning?: string;
}
