# Prompt Design

This document describes the prompt engineering strategy used in the AI User Story Generator, including versioning approach, known limitations, and design rationale for each pipeline step.

---

## Overview

The pipeline uses three distinct prompt templates, each targeted at a single, focused task. Every prompt is:

- Stored as a versioned plain-text file in [`/prompts/`](../prompts/)
- Loaded at runtime by `lib/pipeline.ts` using `fs.readFile`
- Variable-interpolated with `{{key}}` placeholders replaced by `lib/llm.ts`
- Accompanied by a system-level instruction that locks the model into a specific analytical role

---

## Versioning Approach

Prompt files are version-controlled in Git. The strategy is:

- **Minor refinements** (wording, examples, rule clarifications) are made in-place and committed with a descriptive message.
- **Breaking changes** (changed output schema, added/removed fields) get a new filename suffix, e.g. `entity-extraction-v2.txt`. The pipeline import is updated atomically with the schema change.
- **Rollbacks** are handled by reverting the prompt file commit — no migration needed.

---

## Prompt 1 — Entity Extraction (`/prompts/entity-extraction.txt`)

### Role

> Senior requirements analyst — extracts only what is explicitly stated.

### Purpose

Extract three entities from unstructured input: **actor**, **goal**, **value**. Returns `null` for any entity not present.

### Key design decisions

| Decision | Rationale |
|---|---|
| Strict "only extract what's stated" rule | Prevents hallucinated entities from propagating into the story |
| `missing_fields` array in response | Allows downstream steps to handle partial inputs gracefully (use `[MISSING: field]` placeholder) |
| Null rather than empty string for missing | Easier to differentiate "not found" from "found but empty" in TypeScript/Zod |
| Low temperature (0.2) | Extraction is a deterministic task — creativity hurts accuracy here |

### Schema (Zod)

```typescript
{
  actor: z.string().nullable(),
  goal: z.string().nullable(),
  value: z.string().nullable(),
  missing_fields: z.array(z.enum(["actor", "goal", "value"]))
}
```

---

## Prompt 2 — User Story Generation (`/prompts/user-story-generation.txt`)

### Role

> Certified Agile product analyst — writes Jira-formatted user stories only from provided entities.

### Purpose

Generates the complete user story including title, body, priority, story points, labels, and a confidence score.

### Key design decisions

| Decision | Rationale |
|---|---|
| Exact template enforcement: "As a X, I want Y, so that Z." | Jira-standard format; enforced again by the `TEMPLATE_FORMAT` guardrail |
| `[MISSING: field_name]` placeholders for null entities | Makes gaps visible to reviewers rather than silently fabricating content |
| Confidence score (0.0–1.0) | Self-reported estimate of completeness; used by the `CONFIDENCE_THRESHOLD` guardrail (threshold: 0.6) |
| `flags` array | LLM can self-annotate known issues (e.g. `ACTOR_CLARITY`, `GRAMMAR_ISSUE`) that complement the deterministic guardrails |
| Story points from Fibonacci set (1/2/3/5/8/13) | Matches standard Agile estimation; constrained by the Zod enum |

### Schema (Zod)

```typescript
{
  title: z.string().min(1),
  story_body: z.string().min(1),
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  story_points: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(8), z.literal(13)]),
  labels: z.array(z.string()),
  confidence_score: z.number().min(0).max(1),
  flags: z.array(z.string())
}
```

---

## Prompt 3 — Acceptance Criteria (`/prompts/acceptance-criteria.txt`)

### Role

> Senior QA analyst — writes testable Given/When/Then criteria derived strictly from the story.

### Purpose

Generates 2–5 acceptance criteria in Given/When/Then format.

### Key design decisions

| Decision | Rationale |
|---|---|
| Response wrapped in `{"criteria": [...]}` object | The `json_object` response format requires a JSON *object* root — a bare array is not valid. Wrapping avoids an extra heuristic in the parser. |
| 2–5 criteria range | Minimum 2 enforced by the `MINIMUM_AC` guardrail; maximum 5 prevents over-specification |
| Derivation only from the story | No invention — prevents acceptance criteria from smuggling in requirements that weren't in the original input |
| Empty-array fallback | If the LLM returns `{"criteria": []}` for highly ambiguous inputs, the pipeline substitutes a placeholder criterion and the `INSUFFICIENT_AC` guardrail flags the story for manual review |

### Schema (Zod)

```typescript
z.array(z.object({
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.string().min(1),
})).min(1).max(5)
```

---

## Code-Fence Stripping

Some LLM models wrap their JSON output in ` ```json ... ``` ` markdown fences even when `response_format: { type: "json_object" }` is set. The `callLLM()` function in `lib/llm.ts` strips these before returning:

```typescript
const content = rawContent
  .replace(/^```(?:json)?\s*/i, "")
  .replace(/\s*```\s*$/, "")
  .trim();
```

This is applied universally, so all three pipeline steps benefit without per-step handling.

---

## System Prompts

Each pipeline step uses a focused system prompt to anchor the model's behaviour:

| Step | System prompt summary |
|---|---|
| Entity extraction | "Only extract, never infer. Return valid JSON." |
| Story generation | "Only use provided entities. Never add information. Return valid JSON." |
| Acceptance criteria | "Derive only from the story. Never invent. Return valid JSON." |

---

## Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| Multi-story inputs produce a single story | Requirements describing multiple features are condensed into one story | Future: add a story-splitting step before entity extraction |
| Ambiguous BRD language generates weak actors | Formal specs often say "the system shall" — this produces an awkward actor | The `INVALID_TEMPLATE` guardrail flags these for manual review |
| Low-context inputs get low confidence scores | Short inputs like "Add 2FA" produce confidence ~0.3 and hit the `LOW_CONFIDENCE` guardrail | By design — short inputs need manual review |
| Confidence score is self-reported | The model may over- or under-estimate | The 0.6 threshold was chosen conservatively based on observed outputs; it can be tuned |
| `response_format: json_object` is not honoured by all models | Some models still emit code fences | Handled by the fence-stripping post-processor in `callLLM()` |
