# AI User Story Generator

A proof-of-concept tool that converts unstructured business requirements into structured, Jira-ready user stories using AI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 + shadcn/ui + Tailwind CSS |
| Backend / Database | Supabase (Postgres, Auth, Storage) |
| AI Orchestration | Next.js API Routes (server-side pipeline) |
| LLM Access | Requesty (OpenAI-compatible) |
| Jira Integration | Jira REST API |
| Language | TypeScript |

> **Note:** n8n was evaluated as a workflow engine but removed in favour of a direct, server-side TypeScript pipeline (`lib/pipeline.ts`) running inside Next.js API routes. This removes the Docker/n8n dependency and keeps the whole stack in one process.

---

## Prerequisites

Before running the project you need the following tools installed:

### 1 — Install Node.js (v20 LTS recommended)

**Option A — Official installer (simplest for beginners)**

1. Go to <https://nodejs.org>
2. Download the **LTS** version
3. Run the installer and follow the steps
4. Open a new terminal and verify:
   ```bash
   node --version   # should print v20.x.x or higher
   npm --version    # should print 10.x.x or higher
   ```

**Option B — via Homebrew (macOS)**

```bash
# Install Homebrew first if you don't have it:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Then install Node:
brew install node
```

**Option C — via nvm (Node Version Manager, recommended for developers)**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# Restart your terminal, then:
nvm install 20
nvm use 20
```

---

### 2 — Install Git

Most macOS installations already have Git. Verify with:

```bash
git --version
```

If missing, install via Homebrew: `brew install git`

---

## Project Setup

### 1 — Clone the repository

```bash
git clone <your-repo-url>
cd user-story-generator
```

### 2 — Install dependencies

```bash
npm install
```

This installs all packages defined in `package.json`, including Next.js, React, Tailwind, shadcn/ui primitives, Supabase client, and more.

### 3 — Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in the values (see [Environment Variables](#environment-variables) below).

### 4 — Run the development server

```bash
npm run dev
```

Open your browser at <http://localhost:3000>. You should see the landing page.

---

## Environment Variables

| Variable | Description | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Project Settings → API Keys |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase **publishable** key — safe to expose to the browser | Supabase Dashboard → Project Settings → API Keys |
| `SUPABASE_SECRET_KEY` | Supabase **secret** key — server-only, never expose to the browser | Supabase Dashboard → Project Settings → API Keys |
| `REQUESTY_API_KEY` | Requesty API key for LLM access | Requesty dashboard |
| `REQUESTY_BASE_URL` | Requesty base URL (OpenAI-compatible endpoint) | Requesty dashboard |
| `REQUESTY_MODEL` | Model identifier (e.g. `openai/gpt-4o`) | Requesty dashboard |
| `JIRA_BASE_URL` | Your Jira instance base URL (e.g. `https://yourorg.atlassian.net`) | Jira admin |
| `JIRA_API_TOKEN` | Jira API token | <https://id.atlassian.com/manage-profile/security/api-tokens> |
| `JIRA_EMAIL` | Email linked to the Jira API token | Your Atlassian account email |
| `JIRA_PROJECT_KEY` | Jira project key (e.g. `USG`) | Jira project settings |

> **Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. `SUPABASE_SECRET_KEY` and all Requesty / Jira vars must never be used in client-side code.

---

## Project Structure

```
/app                  → Next.js App Router pages and layouts
  /(auth)             → Login and sign-up pages
  /api/generate       → POST endpoint that runs the AI pipeline
/components           → Reusable UI components (shadcn/ui + custom)
  /ui                 → Base shadcn/ui primitives (Button, Card, Input, etc.)
/lib                  → Core logic modules
  supabase.ts         → Supabase browser client
  supabase-server.ts  → Supabase server client (for API routes / middleware)
  llm.ts              → LLM client wrapper (Requesty / OpenAI-compatible)
  pipeline.ts         → Multi-step AI generation pipeline
  schemas.ts          → Zod schemas for LLM output validation
  guardrails.ts       → Safety and quality guardrails
  jira.ts             → Jira REST API helpers
  utils.ts            → Tailwind class merge utility (cn)
/types                → Shared TypeScript interfaces
/prompts              → Versioned LLM prompt templates
/mock-data            → Sample requirement inputs for development/testing
/scripts              → Utility scripts (e.g. Supabase seed)
/supabase/migrations  → SQL migration files for the database schema
/docs                 → Project documentation
/plans                → Architecture and implementation plans
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Next.js development server at http://localhost:3000 |
| `npm run build` | Build the app for production |
| `npm run start` | Start the production server (requires `build` first) |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier to format all files |

---

## Implementation Phases

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Project Setup and Scaffolding | ✅ Done |
| Phase 2 | Supabase Schema and Auth | ✅ Done |
| Phase 3 | AI Pipeline (replaces n8n) | ✅ Done |
| Phase 4 | Frontend UI Implementation | ✅ Done |
| Phase 5 | LLM Integration and Prompt Design | ✅ Done |
| Phase 6 | Jira REST API Integration | ✅ Done |
| Phase 7 | Review and Approval Workflow | ✅ Done |
| Phase 8 | Guardrails and Safety Layer | ✅ Done |
| Phase 9 | Mock Data and Testing | ✅ Done |
| Phase 10 | Documentation and Deliverables | ✅ Done |

See [`plans/implementation-plan.md`](./plans/implementation-plan.md) for the full plan.

### Phase 3 note — n8n removed

The original plan included n8n as a visual workflow engine (running locally via Docker). After evaluation it was replaced by a pure TypeScript server-side pipeline:

- `lib/pipeline.ts` — orchestrates entity extraction → story generation → acceptance criteria steps
- `lib/llm.ts` — thin wrapper around the Requesty (OpenAI-compatible) client
- `lib/schemas.ts` — Zod schemas that validate and type LLM JSON output
- `lib/guardrails.ts` — post-processing safety checks
- `app/api/generate/route.ts` — the single HTTP entry point for the pipeline

This eliminates the Docker/n8n dependency while keeping the same multi-step AI logic.

---

## Troubleshooting

**TypeScript errors in the editor before `npm install`**

These are expected — the editor can't resolve packages that haven't been installed yet. Run `npm install` and all errors will clear.

**`node: command not found`**

Node.js is not installed or not on your PATH. Follow the [Node.js installation steps](#1--install-nodejs-v20-lts-recommended) above and open a fresh terminal.

**Port 3000 already in use**

```bash
npm run dev -- -p 3001
```
