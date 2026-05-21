# User Story Generator — MCP Server

The **User Story Generator MCP Server** exposes the application's full feature-set as [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) tools so that AI assistants (Roo Code, Claude Desktop, Cursor, …) can manage projects, requirements, and user stories without using the web UI.

The MCP endpoint runs **inside the Next.js app** at `/api/mcp` — no separate process or deployment needed.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Environment variables](#3-environment-variables)
4. [Running with MCP Inspector](#4-running-with-mcp-inspector)
5. [Configuring in Roo Code (VS Code)](#5-configuring-in-roo-code-vs-code)
6. [Configuring in Claude Desktop](#6-configuring-in-claude-desktop)
7. [Available tools reference](#7-available-tools-reference)
8. [What you can achieve](#8-what-you-can-achieve)
9. [Security notes](#9-security-notes)

---

## 1. Architecture Overview

```
AI Assistant (Roo Code / Claude Desktop)
        │   HTTP  x-mcp-api-key header
        ▼
┌──────────────────────────────────────┐
│  Next.js app  /api/mcp               │  app/api/mcp/route.ts
│  (Streamable HTTP transport)         │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  MCP Server (lib/mcp-server.ts)│  │
│  │  Tool handlers (lib/mcp-tools/)│  │
│  └──────────────┬─────────────────┘  │
│                 │ Supabase service-   │
│                 │ role client        │
└─────────────────┼────────────────────┘
                  ▼
            Supabase DB
```

All MCP logic runs inside the Next.js process. Deploying the app automatically deploys the MCP endpoint.

---

## 2. Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18 |
| Running Next.js app | local (`http://localhost:3000`) or deployed |

---

## 3. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase anon/publishable key |
| `SUPABASE_SECRET_KEY` | ✅ | Supabase **service-role** secret key (bypasses RLS) |
| `MCP_API_KEY` | ✅ | Shared secret used by MCP clients to authenticate |
| `REQUESTY_API_KEY` | ✅ | LLM provider API key |
| `JIRA_*` | optional | Jira integration credentials |

Generate a strong `MCP_API_KEY`:

```bash
openssl rand -hex 32
```

---

## 4. Running with MCP Inspector

[MCP Inspector](https://github.com/modelcontextprotocol/inspector) is the official browser-based debugging UI. Use it to explore and test all 14 tools interactively.

```bash
# 1. Start the Next.js app
npm run dev

# 2. In another terminal, open the Inspector UI
npx @modelcontextprotocol/inspector \
  --transport streamable-http \
  --url http://localhost:3000/api/mcp \
  --header "x-mcp-api-key: your-secret-mcp-api-key"
```

This opens **http://localhost:5173** in your browser with all 14 tools ready to test.

> **Tip:** If your version of the Inspector does not support `--transport streamable-http`, open the Inspector without arguments (`npx @modelcontextprotocol/inspector`), select **Streamable HTTP** as the transport in the UI, enter `http://localhost:3000/api/mcp` as the URL, and add the `x-mcp-api-key` header before clicking **Connect**.

---

## 5. Configuring in Roo Code (VS Code)

1. Open the Command Palette (`⌘ Shift P` / `Ctrl Shift P`).
2. Search for **"Roo Code: Open MCP Settings"** (or edit `~/.roo/mcp.json` directly).
3. Add the following entry:

```json
{
  "mcpServers": {
    "user-story-generator": {
      "transportType": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "x-mcp-api-key": "your-secret-mcp-api-key"
      }
    }
  }
}
```

For a deployed app, replace the URL:

```json
{
  "mcpServers": {
    "user-story-generator": {
      "transportType": "http",
      "url": "https://your-app.vercel.app/api/mcp",
      "headers": {
        "x-mcp-api-key": "your-secret-mcp-api-key"
      }
    }
  }
}
```

4. Save the file and reload the MCP connection. All 14 tools will appear in the tool palette.

---

## 6. Configuring in Claude Desktop

Edit the config file:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "user-story-generator": {
      "transportType": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "x-mcp-api-key": "your-secret-mcp-api-key"
      }
    }
  }
}
```

Restart Claude Desktop to apply the change.

---

## 7. Available Tools Reference

### Projects

| Tool | Description | Key parameters |
|---|---|---|
| `list_projects` | List all projects | — |
| `get_project` | Get a single project | `project_id` (UUID) |
| `create_project` | Create a new project | `name`, `user_id`, `description?` |

### Requirements

| Tool | Description | Key parameters |
|---|---|---|
| `list_requirements` | List requirements | `project_id?`, `status?` |
| `get_requirement` | Get a single requirement | `requirement_id` (UUID) |

### User Stories

| Tool | Description | Key parameters |
|---|---|---|
| `list_stories` | List stories | `requirement_id?`, `status?`, `priority?` |
| `get_story` | Get a single story | `story_id` (UUID) |
| `approve_story` | Approve a story | `story_id` |
| `reject_story` | Reject with feedback | `story_id`, `feedback` (≥ 10 chars) |
| `update_story` | Update story fields | `story_id`, + any of `title`, `story_body`, `acceptance_criteria`, `priority`, `story_points`, `labels`, `status` |

### AI Generation

| Tool | Description | Key parameters |
|---|---|---|
| `generate_stories` | Run the AI pipeline on new text | `project_id`, `raw_input` (≥ 10 chars) |
| `regenerate_stories` | Re-run pipeline with feedback | `requirement_id`, `feedback` (≥ 10 chars) |

### Jira Integration

| Tool | Description | Key parameters |
|---|---|---|
| `list_jira_projects` | List available Jira projects | — |
| `export_to_jira` | Export an approved story to Jira | `story_id`, `dry_run?` |

---

## 8. What You Can Achieve

### End-to-end story generation

> **"Generate user stories for the checkout redesign"**

1. `list_projects` → find the project UUID.
2. `generate_stories` with the UUID and requirement text.
3. Review with `list_stories` or `get_story`.

### Story review and approval

> **"Approve all high-confidence draft stories for requirement X"**

1. `list_stories` with `requirement_id` and `status: "draft"`.
2. `approve_story` for each story with `confidence_score ≥ 0.7`.
3. `reject_story` for lower-confidence ones with improvement feedback.

### Iterative refinement

> **"The actor is wrong — regenerate with the correct role"**

1. `get_requirement` to confirm the UUID.
2. `regenerate_stories` with corrective feedback.
3. Review the new draft stories.

### Bulk Jira export

> **"Export all approved stories to Jira"**

1. `list_stories` with `status: "approved"`.
2. Optionally preview each with `export_to_jira` + `dry_run: true`.
3. `export_to_jira` for each story to create Jira issues.

### Story editing

> **"Set story X to 8 points and add the 'payment' label"**

- `update_story` with `story_points: 8` and `labels: ["payment"]`.

---

## 9. Security Notes

- **`MCP_API_KEY`** grants full read/write access to all data without a user session. Use a strong random value (≥ 32 bytes) and treat it like a password. Rotate it if exposed.
- **`SUPABASE_SECRET_KEY`** bypasses all RLS policies. It stays inside the Next.js server process and is never sent to MCP clients.
- For production, inject all secrets via your secrets manager (e.g. Vercel environment variables). Never commit them to version control.
