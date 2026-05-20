# Guardrails Design

This document describes the guardrail system used to validate AI-generated user stories before they are stored or exported.

---

## Purpose

The guardrail layer acts as a deterministic quality gate between the LLM output and the database. It enforces structural and quality rules that the LLM alone cannot reliably guarantee, and produces human-readable warnings surfaced to the user in the UI.

---

## Architecture

Guardrails run in `lib/guardrails.ts` as a pure function with no side effects:

```typescript
validateStory(story: PipelineResult): GuardrailResult
```

It is called by `POST /api/generate` immediately after the pipeline completes, before any story is written to the database.

```
Pipeline Result
      │
      ▼
validateStory()
      │
      ├── TEMPLATE_FORMAT check
      ├── NO_MISSING_FIELDS check
      ├── CONFIDENCE_THRESHOLD check
      └── MINIMUM_AC check
      │
      ▼
GuardrailResult {
  passed: boolean,
  warnings: string[],
  flags: string[],
  checks: GuardrailCheck[]  ← written to guardrail_logs table
}
```

---

## Rules

### Rule 1 — Template Format (`TEMPLATE_FORMAT`)

**Check:** Story body matches the regex:
```
/^As a .+, I want .+, so that .+\.$/i
```

**Why:** The Agile user story format is a hard requirement for Jira readability and team alignment. Stories that deviate from it are harder to understand and estimate.

**Triggers when:** The LLM produces a story in passive voice, omits "so that", or generates a description instead of a story.

**Effect:** Story stored with `status: needs_changes`. Flag `INVALID_TEMPLATE` added.

---

### Rule 2 — No Missing Fields (`NO_MISSING_FIELDS`)

**Check:** Neither `title` nor `story_body` contains a `[MISSING: ...]` placeholder.

**Why:** Missing-field placeholders indicate the input lacked enough information to generate a complete story. These stories must be reviewed and completed before approval.

**Triggers when:** Entity extraction returns `null` for actor, goal, or value (common in ambiguous inputs like "Add dark mode" or "Add 2FA").

**Effect:** Story stored with `status: needs_changes`. Flag `MISSING_FIELDS` added.

---

### Rule 3 — Confidence Threshold (`CONFIDENCE_THRESHOLD`)

**Check:** `confidence_score >= 0.6`

**Why:** The LLM self-reports how confident it is that the story accurately reflects the input. Scores below 0.6 indicate the input was too ambiguous for a reliable story.

**Threshold rationale:** 0.6 was selected based on observed LLM outputs during Phase 9 testing:
- Score ≥ 0.85 — well-formed inputs with clear actor, goal, and value
- Score 0.6–0.84 — partial inputs; story is reasonable but may need review
- Score < 0.6 — ambiguous or incomplete inputs; story likely needs significant rework

**Effect:** Story stored with `status: needs_changes`. Flag `LOW_CONFIDENCE` added. Warning shown in the UI.

**Note:** This is a soft gate — the story is still stored, just flagged. The Jira export hard-blocks `needs_changes` stories.

---

### Rule 4 — Minimum Acceptance Criteria (`MINIMUM_AC`)

**Check:** The `acceptance_criteria` text contains at least 2 numbered blocks (regex: `/^\d+\./gm`).

**Why:** A single acceptance criterion is rarely sufficient to make a story testable. Two or more ensure the story captures at least a happy path and one edge case or pre-condition.

**Triggers when:** The LLM returns fewer than 2 criteria, which happens for very short or ambiguous inputs.

**Effect:** Story stored with `status: needs_changes`. Flag `INSUFFICIENT_AC` added.

---

## Guardrail Logs

Every guardrail check — whether it passes or fails — is written to the `guardrail_logs` table:

| Column | Description |
|---|---|
| `story_id` | FK to the generated story |
| `rule` | Stable rule code (e.g. `TEMPLATE_FORMAT`) |
| `passed` | Boolean outcome |
| `details` | Human-readable description of the outcome |
| `created_at` | UTC timestamp |

This provides a complete audit trail for all guardrail decisions. Failed checks are the source of the `flags` array stored on the story record.

---

## UI Integration

### Warning banner on generation

When `POST /api/generate` returns a `warnings` array, `RequirementInput` shows an amber banner listing each warning with a **View Stories →** button. The user is not automatically redirected, giving them the opportunity to read the warnings before proceeding.

### Flags on story cards

Each `StoryCard` displays any flags from the `flags[]` array in an amber warning box. The story detail page shows a dedicated "Flags & Warnings" card in the right panel.

### Jira export block

`POST /api/jira/create` returns HTTP 409 if the story `status` is not `approved`. Stories with guardrail failures start in `needs_changes` and cannot be exported until a reviewer edits and approves them.

---

## Effectiveness Observations (Phase 9)

From the 10 mock inputs in `mock-data/requirements.json`:

| Input type | Typical outcome |
|---|---|
| Well-formed feature descriptions (meeting notes, email) | All guardrails pass — `status: draft`, no flags |
| Formal BRD inputs | Often fail `TEMPLATE_FORMAT` (passive voice actors like "the system shall") |
| Ambiguous single-phrase inputs | Fail `NO_MISSING_FIELDS` + `CONFIDENCE_THRESHOLD` + `MINIMUM_AC` |
| Multi-requirement inputs | May fail `MISSING_FIELDS` if the input is condensed into one story with missing entities |

The guardrails correctly identified all expected failure cases in testing with 0 false negatives and a small number of false positives (BRD-style inputs with non-standard actors).

---

## Extending Guardrails

To add a new rule:

1. Add a constant and logic block in `lib/guardrails.ts` following the existing pattern
2. Push a `GuardrailCheck` entry with a stable `rule` code
3. If it's a blocking rule (adds to `warnings`), add the flag code to `flags`
4. The `guardrail_logs` insert in `POST /api/generate` will automatically pick it up — no changes needed there
