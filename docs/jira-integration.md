# Jira Integration

This document describes how the AI User Story Generator integrates with the Jira REST API, including setup instructions, field mapping, dry-run mode, and error handling.

---

## Setup

### 1 — Create a Jira API token

1. Go to <https://id.atlassian.com/manage-profile/security/api-tokens>
2. Click **Create API token**
3. Give it a name (e.g. "User Story Generator") and copy the token value

### 2 — Find your Jira project key

In your Jira project, the project key is the short uppercase code shown next to issue numbers (e.g. if issues are named `USG-1`, `USG-2`, the key is `USG`).

### 3 — Configure environment variables

Add the following to `.env.local`:

```env
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_API_TOKEN=<your-api-token>
JIRA_EMAIL=<email-linked-to-the-api-token>
JIRA_PROJECT_KEY=USG
```

Optional — if your Jira instance uses a custom field ID for story points other than `customfield_10016`:

```env
JIRA_STORY_POINTS_FIELD=customfield_99999
```

---

## Field Mapping

| App field | Jira field | Notes |
|---|---|---|
| `title` | `summary` | Max 255 chars |
| `story_body` + `acceptance_criteria` | `description` (ADF) | Combined with a separator line; rendered as Atlassian Document Format paragraphs |
| `priority` | `priority.name` | Values: `Low`, `Medium`, `High`, `Critical` — must match Jira priority names exactly |
| `labels` | `labels` | Array of lowercase hyphen-separated strings |
| `story_points` | `customfield_10016` | Fibonacci values: 1, 2, 3, 5, 8, 13 |
| `status` set to `"exported"` | — | Stored on the app record after successful creation |
| — | `issuetype.name` | Always `"Story"` |
| — | `project.key` | From `JIRA_PROJECT_KEY` env var |

---

## API Endpoints Used

| Endpoint | Method | Purpose |
|---|---|---|
| `/rest/api/3/issue` | `POST` | Create a new Jira issue |
| `/rest/api/3/project` | `GET` | List accessible projects (used by `/api/jira/projects`) |

Authentication uses **HTTP Basic Auth**: `base64(email:api_token)` sent in the `Authorization` header.

---

## Dry-Run Mode

Before creating a real Jira ticket, users can preview the exact payload that would be sent:

1. On the story detail page, check the **Dry run** checkbox next to the export button.
2. Click **Dry Run** — the app calls `POST /api/jira/create` with `{ dry_run: true }`.
3. The server builds the Jira payload and returns it without making any network call to Jira.
4. A message confirms "Dry-run payload preview generated (no Jira issue created)."

This is useful for:
- Verifying field mapping before first use
- Testing with Jira credentials configured but project not yet ready
- Reviewing the ADF description format

---

## Status Guards

The `/api/jira/create` route enforces two guards before creating a ticket:

| Guard | HTTP status | Message |
|---|---|---|
| Story must be `approved` | 409 | "Story must be in 'approved' status before exporting to Jira." |
| Story already exported | 409 | "Story has already been exported to Jira as `<key>`." |

Dry-run requests bypass the `approved` status guard so you can preview any story's payload.

---

## After Export

On successful ticket creation:

1. The `jira_issue_key` (e.g. `USG-42`) is stored on the `user_stories` record.
2. The story `status` is updated to `"exported"`.
3. The story detail page shows a link to the Jira issue.
4. Further exports are blocked by the duplicate-export guard.

If the Jira API call succeeds but the database update fails (rare network/DB partition scenario), the API returns HTTP 207 with a warning message and the issue key so it can be manually recorded.

---

## Error Handling

| Error | App behaviour |
|---|---|
| `401 / 403` from Jira | Returns `502` to the frontend with "Jira API error" — indicates a credentials or permission problem |
| `400` from Jira (field validation) | Returns `422` with field-level Jira error messages |
| Other 5xx from Jira | Returns `502` |
| Missing env vars | Throws `JiraError` before any network call; returns `500` |
| Network timeout | Axios default timeout; surfaces as `502` |

All `JiraError` instances include `statusCode`, `jiraErrors` (field-level), and `jiraErrorMessages` for structured logging.

---

## Jira Priority Name Compatibility

The app priority values (`Low`, `Medium`, `High`, `Critical`) are sent directly to Jira's `priority.name` field. If your Jira instance uses different priority names (e.g. `Highest` instead of `Critical`), the API will return a 400 field validation error. In that case, update the `story_priority` enum in the database migration and the `Priority` type in `types/index.ts` to match your Jira configuration.
