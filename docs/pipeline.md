# AI Pipeline Design

This document describes the in-app AI processing pipeline — its architecture, step breakdown, data flow, and error handling strategy.

---

## Overview

The pipeline runs server-side inside a single Next.js API route (`POST /api/generate`). It orchestrates three sequential LLM calls and applies guardrails before persisting any data. No external workflow engine is used.

```
POST /api/generate
        │
        ▼
┌──────────────────┐
│  1. Authenticate │  Supabase session check
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 2. Save Req.     │  Insert requirements row (status: processing)
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│          AI Pipeline (lib/pipeline.ts)        │
│                                              │
│  Step 1: extractEntities(rawInput)           │
│    ↓ EntityExtraction                        │
│  Step 2: generateStory(entities)             │
│    ↓ UserStoryGeneration                     │
│  Step 3: generateAcceptanceCriteria(story)   │
│    ↓ AcceptanceCriterion[]                   │
│  Assemble → PipelineResult                   │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ 3. Run Guardrails│  validateStory(result) → GuardrailResult
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 4. Persist Story │  Insert user_stories + guardrail_logs
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 5. Return        │  { requirement_id, stories[], warnings? }
└──────────────────┘
```

---

## Step 1 — Entity Extraction

**Function:** [`extractEntities(rawInput)`](../lib/pipeline.ts)  
**Prompt:** [`/prompts/entity-extraction.txt`](../prompts/entity-extraction.txt)  
**Output type:** `EntityExtraction`

Extracts three entities from unstructured text: `actor`, `goal`, `value`. Returns `null` for any entity not explicitly present. The `missing_fields` array tells downstream steps which entities need `[MISSING: field]` placeholders.

```json
{
  "actor": "customers",
  "goal": "reset their password from the mobile app without calling support",
  "value": "avoid calling support",
  "missing_fields": []
}
```

---

## Step 2 — User Story Generation

**Function:** [`generateStory(entities)`](../lib/pipeline.ts)  
**Prompt:** [`/prompts/user-story-generation.txt`](../prompts/user-story-generation.txt)  
**Output type:** `UserStoryGeneration`

Generates the full user story from the extracted entities. Enforces the Agile story template (`"As a X, I want Y, so that Z."`). Uses `[MISSING: field]` placeholders for null entities. Also infers metadata: priority, story points (Fibonacci), labels, and a self-reported confidence score.

```json
{
  "title": "Self-service password reset in mobile app",
  "story_body": "As a customer, I want to reset my password from the mobile app without calling support, so that I can avoid calling support.",
  "priority": "High",
  "story_points": 5,
  "labels": ["mobile", "authentication", "self-service"],
  "confidence_score": 0.95,
  "flags": []
}
```

---

## Step 3 — Acceptance Criteria Generation

**Function:** [`generateAcceptanceCriteria(storyBody)`](../lib/pipeline.ts)  
**Prompt:** [`/prompts/acceptance-criteria.txt`](../prompts/acceptance-criteria.txt)  
**Output type:** `AcceptanceCriterion[]`

Generates 2–5 Given/When/Then acceptance criteria strictly derived from the story body. The response is wrapped in `{"criteria": [...]}` to satisfy the `json_object` response format requirement.

The serialised output stored in the database:

```
1. Given the customer is logged out of the mobile app
   When they tap "Forgot password" and enter their email
   Then they receive a password reset email within 60 seconds

2. Given the customer follows the reset link
   When they enter a new password that meets the security policy
   Then their password is updated and they receive a confirmation email
```

**Empty-array fallback:** If the LLM returns `{"criteria": []}` (common for highly ambiguous inputs), a placeholder criterion is inserted and the `INSUFFICIENT_AC` guardrail fires.

---

## LLM Client (`lib/llm.ts`)

All three steps call `callLLM(userPrompt, variables, options)`:

- **Variable interpolation:** `{{key}}` placeholders replaced before the request
- **Response format:** `response_format: { type: "json_object" }` on every call
- **Code-fence stripping:** Leading ` ```json ` and trailing ` ``` ` are stripped post-response to handle models that ignore `json_object` mode
- **Temperature:** 0.2 (low — extraction tasks benefit from determinism)
- **Retry logic:** Up to 3 attempts with exponential back-off (500ms, 1s, 2s) on 5xx / network errors
- **Timeout:** 60 seconds per request

---

## Guardrails

After the pipeline completes, `validateStory(result)` in `lib/guardrails.ts` runs four deterministic checks:

| Rule | Code | What it checks |
|---|---|---|
| Template format | `TEMPLATE_FORMAT` | Story body matches `"As a X, I want Y, so that Z."` regex |
| No missing placeholders | `NO_MISSING_FIELDS` | No `[MISSING: ...]` strings in title or body |
| Confidence threshold | `CONFIDENCE_THRESHOLD` | `confidence_score >= 0.6` |
| Minimum AC | `MINIMUM_AC` | At least 2 numbered criteria in `acceptance_criteria` |

Stories that fail any check are stored with `status: "needs_changes"` instead of `"draft"`. All check results (pass and fail) are written to the `guardrail_logs` table.

---

## Error Handling Strategy

| Failure point | Behaviour |
|---|---|
| Auth failure | 401 — request rejected before pipeline starts |
| DB insert failure (requirement) | 500 — pipeline never starts |
| LLM call fails (all retries exhausted) | `LLMError` thrown — requirement marked `failed`, 502 returned |
| LLM returns invalid JSON | `LLMError` thrown — same as above |
| Zod schema validation fails | `LLMError` thrown — same as above |
| DB insert failure (story) | Error thrown — requirement marked `failed`, 500 returned |
| Partial results are **never** persisted | The pipeline is all-or-nothing — no half-written stories |

**Retry:** Only LLM calls are retried (transient network/infrastructure failures). DB errors and schema failures are not retried — they surface immediately for investigation.

---

## Sequential vs. Parallel Execution

The three pipeline steps run **sequentially** by design:

1. Entity extraction must complete before story generation (it provides the input)
2. Story generation must complete before acceptance criteria (the story body is required)

Parallelisation is not possible without changing the data flow. If latency becomes a concern in a future iteration, the story metadata (priority/points/labels) could be generated in parallel with acceptance criteria.

---

## Adding a New Pipeline Step

1. Create a new prompt file in `/prompts/`
2. Add a Zod schema in `lib/schemas.ts`
3. Add a function in `lib/pipeline.ts` following the pattern of the existing steps
4. Call it from `runPipeline()` and include its output in `PipelineResult`
5. Update guardrails if the new step introduces new validation rules
