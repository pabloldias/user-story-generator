# Findings and Observations

This document records what worked well, what didn't, and key observations from building and testing the AI User Story Generator PoC.

---

## What Worked Well

### 1 — Sequential 3-step pipeline

Breaking the generation into entity extraction → story generation → acceptance criteria produced consistently better results than a single "generate everything" prompt. Each step has a narrow, well-defined task, which:

- Reduces hallucination (the model stays focused)
- Makes debugging easier — failures are isolated to one step
- Allows independent schema validation at each boundary

### 2 — Strict entity extraction first

Extracting entities before writing the story was the single most impactful design decision. It forces the model to separate "what is stated" from "what to write", which significantly reduced invented detail in the story bodies. The `missing_fields` array gave downstream steps a clean signal for when to use `[MISSING: ...]` placeholders.

### 3 — Deterministic guardrails over probabilistic

Using regex and numeric checks (template format, confidence threshold, AC count) rather than asking the LLM to self-validate was more reliable and faster. The LLM self-reports confidence but the structural rules are non-negotiable and run in microseconds.

### 4 — `response_format: json_object` + Zod validation

Enforcing JSON output at the API level combined with Zod schema validation at every step eliminated an entire class of parsing bugs. When Zod fails it produces a structured error with the exact field path, making debugging faster than string parsing errors.

### 5 — Supabase RLS as the auth layer

Implementing Row Level Security in SQL rather than application-level guards meant that even direct Supabase client calls were safe by default. No route accidentally bypassed ownership checks.

### 6 — Dry-run mode for Jira

The Jira dry-run mode was essential during development — it allowed verifying the exact payload structure and ADF description format without creating test tickets in a live Jira project.

---

## What Didn't Work / Limitations

### 1 — `response_format: json_object` not universally respected

Several models (including the one used during Phase 9 testing) returned JSON wrapped in ` ```json ... ``` ` markdown fences despite the `json_object` response format being set. This required adding a post-processing strip in `callLLM()`. This is a known model-level non-compliance and not a Requesty issue.

### 2 — Multi-story inputs produce a single story

Inputs describing multiple features (e.g. a full onboarding flow) are condensed into a single story by entity extraction. The LLM tries to summarise rather than split. A future iteration should add a story-count detection step before entity extraction to handle multi-requirement inputs.

### 3 — BRD-style inputs trigger `INVALID_TEMPLATE` frequently

Formal BRD language ("the system shall...") produces actors like "the system" or "administrative actions", which don't fit the `"As a human actor..."` Agile template. The `INVALID_TEMPLATE` guardrail fires correctly but the fix requires human editorial work. A pre-processing normalisation step could improve this.

### 4 — Confidence score is self-reported and inconsistent

The same input can yield confidence scores that vary ±0.1–0.15 between runs. The 0.6 threshold works in practice but the score should be treated as a rough indicator rather than a precise measurement. A future iteration could augment it with deterministic completeness checks (e.g. "does the story have all three entities?").

### 5 — Acceptance criteria for ambiguous inputs are empty or shallow

Highly ambiguous inputs ("Add 2FA", "Make checkout faster") sometimes produce zero or one acceptance criterion. The empty-array fallback prevents pipeline failures, but the resulting criteria are placeholder-quality and need significant manual work.

### 6 — Story points and priority are weakly calibrated

The LLM assigns story points based on perceived "complexity implied by the goal", which produces inconsistent estimates — simple features sometimes get 8 points and complex ones get 2. These values should always be reviewed by the team before the story is approved.

---

## Key Design Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| Remove n8n | Docker dependency + maintenance overhead wasn't justified for a PoC | Correct — the pure TypeScript pipeline is simpler and faster to iterate on |
| 3-step sequential pipeline | Better isolation, easier debugging | Worked well; latency (~15–30s) is acceptable for a PoC |
| Zod schema validation at every step | Catch LLM output drift early | Caught multiple real formatting issues during development |
| Store all guardrail check results | Enables analysis of failure patterns | Useful — Phase 9 showed clear patterns by input type |
| Status-based Jira export guard | Prevent accidental export of low-quality stories | Correct — keeps the workflow intentional |

---

## Observed LLM Behaviour Patterns

Based on Phase 9 dry-run results across 10 mock inputs:

| Observation | Frequency |
|---|---|
| Well-formed inputs produce `draft` status, no flags | 4/10 (all feature description / email style inputs) |
| BRD inputs fail `TEMPLATE_FORMAT` | 2/2 BRD inputs |
| Ambiguous single-phrase inputs fail 3+ guardrails | 3/3 ambiguous inputs |
| Code fences in LLM output (bypassing `json_object` mode) | All 10 inputs (stripped automatically) |
| Empty acceptance criteria array | 2/10 (both highly ambiguous inputs) |

---

## Recommendations for v2

1. **Story splitting** — detect multi-requirement inputs and split them before entity extraction
2. **Actor normalisation** — pre-process BRD language to convert passive constructions to active actors
3. **Confidence calibration** — supplement self-reported confidence with a deterministic completeness score (e.g. 1 point per non-null entity)
4. **Story points review UI** — highlight story_points as "AI estimate — please review" in the UI
5. **Async generation** — for long inputs, run the pipeline in a background job and use polling/webhooks to update the UI rather than blocking the HTTP request
6. **Prompt versioning UI** — admin page to switch between prompt versions for A/B testing
