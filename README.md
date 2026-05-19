# AI User Story Generator

A proof-of-concept tool that converts unstructured business requirements into structured, Jira-ready user stories using AI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 + shadcn/ui + Tailwind CSS |
| Backend / Database | Supabase (Postgres, Auth, Storage) |
| Workflow Orchestration | n8n (local) |
| LLM Access | Requesty (OpenAI-compatible) |
| Jira Integration | Jira REST API |
| Language | TypeScript |

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

This installs all packages defined in `package.json`, including Next.js, React, Tailwind, shadcn/ui primitives, Supabase client, and more. All TypeScript errors visible before this step will disappear.

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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase **publishable** key (new model, replaces legacy anon key) — safe to expose to the browser | Supabase Dashboard → Project Settings → API Keys |
| `SUPABASE_SECRET_KEY` | Supabase **secret** key (new model, replaces legacy service_role key) — server-only, never expose to the browser | Supabase Dashboard → Project Settings → API Keys |
| `N8N_WEBHOOK_URL` | Full URL of the n8n webhook trigger | n8n workflow → Webhook node URL |
| `JIRA_BASE_URL` | Your Jira instance base URL (e.g. `https://yourorg.atlassian.net`) | Jira admin |
| `JIRA_API_TOKEN` | Jira API token | <https://id.atlassian.com/manage-profile/security/api-tokens> |
| `JIRA_EMAIL` | Email linked to the Jira API token | Your Atlassian account email |
| `JIRA_PROJECT_KEY` | Jira project key (e.g. `USG`) | Jira project settings |

> **Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. `SUPABASE_SECRET_KEY` must never be used in client-side code.

---

## Running n8n Locally (required for story generation)

n8n is the workflow engine that calls the LLM. It runs locally via Docker.

### Install Docker

1. Download Docker Desktop from <https://www.docker.com/products/docker-desktop/>
2. Install and start it

### Start n8n

```bash
docker run -it --rm -p 5678:5678 n8nio/n8n
```

Open <http://localhost:5678> and configure your workflow (see Phase 3 in the implementation plan).

Once your webhook is set up, copy the webhook URL into your `.env.local` as `N8N_WEBHOOK_URL`.

---

## Project Structure

```
/app              → Next.js App Router pages and layouts
/components       → Reusable UI components (shadcn/ui + custom)
  /ui             → Base shadcn/ui primitives (Button, Card, Input, etc.)
/lib              → Utility modules
  supabase.ts     → Supabase browser client
  n8n.ts          → n8n webhook trigger helper
  jira.ts         → Jira REST API helpers
  utils.ts        → Tailwind class merge utility (cn)
/types            → Shared TypeScript interfaces
/prompts          → Versioned LLM prompt templates
/mock-data        → Sample requirement inputs for development/testing
/scripts          → Utility scripts (e.g. Supabase seed)
/n8n/workflows    → Exported n8n workflow JSON files
/docs             → Project documentation
/plans            → Architecture and implementation plans
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
| Phase 2 | Supabase Schema and Auth | 🔲 Next |
| Phase 3 | n8n Workflow Design | 🔲 Pending |
| Phase 4 | Frontend UI Implementation | 🔲 Pending |
| Phase 5 | LLM Integration and Prompt Design | 🔲 Pending |
| Phase 6 | Jira REST API Integration | 🔲 Pending |
| Phase 7 | Review and Approval Workflow | 🔲 Pending |
| Phase 8 | Guardrails and Safety Layer | 🔲 Pending |
| Phase 9 | Mock Data and Testing | 🔲 Pending |
| Phase 10 | Documentation and Deliverables | 🔲 Pending |

See [`plans/implementation-plan.md`](./plans/implementation-plan.md) for the full plan.

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

**n8n webhook unreachable**

Ensure Docker is running and n8n is started. Check that `N8N_WEBHOOK_URL` in `.env.local` points to `http://localhost:5678/webhook/<your-id>`.
