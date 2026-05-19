import type { PipelineResult } from "./schemas";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.6;
const STORY_TEMPLATE_REGEX = /^As a .+, I want .+, so that .+\.$/i;
const MISSING_PLACEHOLDER_REGEX = /\[MISSING:[^\]]+\]/;
const MIN_AC_LINES = 2; // at least 2 "Given/When/Then" blocks

// ─── Result type ──────────────────────────────────────────────────────────────

export interface GuardrailCheck {
  /** Stable identifier for the rule, matches what is stored in guardrail_logs.rule */
  rule: string;
  passed: boolean;
  /** Human-readable description of the outcome (stored in guardrail_logs.details) */
  details: string;
}

export interface GuardrailResult {
  /** True if no blocking violations were found. */
  passed: boolean;
  /** Human-readable warnings to surface to the user. */
  warnings: string[];
  /** Machine-readable flag codes to store on the story record. */
  flags: string[];
  /** Per-rule results — used to populate the guardrail_logs table. */
  checks: GuardrailCheck[];
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Runs all guardrail checks against a completed pipeline result.
 *
 * Rules:
 * 1. Story body must match the "As a… I want… so that…" template.
 * 2. No `[MISSING: field]` placeholders remaining in story body or title.
 * 3. Confidence score must be ≥ 0.6; below that it is auto-flagged for review.
 * 4. At least 2 acceptance criteria blocks must be present.
 *
 * A result `passed: false` should result in the story being stored with
 * status `needs_changes` rather than `draft`.
 */
export function validateStory(story: PipelineResult): GuardrailResult {
  const warnings: string[] = [];
  const flags: string[] = [...story.flags]; // preserve any flags from the LLM itself
  const checks: GuardrailCheck[] = [];

  // ── Rule 1: Template format ──────────────────────────────────────────────
  const templatePassed = STORY_TEMPLATE_REGEX.test(story.story_body.trim());
  const templateDetail = templatePassed
    ? 'Story body matches the "As a… I want… so that…" template.'
    : 'Story body does not follow the required "As a [actor], I want [goal], so that [value]." format.';
  checks.push({ rule: "TEMPLATE_FORMAT", passed: templatePassed, details: templateDetail });
  if (!templatePassed) {
    warnings.push(templateDetail);
    flags.push("INVALID_TEMPLATE");
  }

  // ── Rule 2: No missing-field placeholders ────────────────────────────────
  const hasMissing =
    MISSING_PLACEHOLDER_REGEX.test(story.story_body) ||
    MISSING_PLACEHOLDER_REGEX.test(story.title);
  const missingDetail = hasMissing
    ? "Story contains [MISSING: ...] placeholders. Required fields could not be extracted from the input."
    : "No missing-field placeholders detected.";
  checks.push({ rule: "NO_MISSING_FIELDS", passed: !hasMissing, details: missingDetail });
  if (hasMissing) {
    warnings.push(missingDetail);
    flags.push("MISSING_FIELDS");
  }

  // ── Rule 3: Confidence threshold ─────────────────────────────────────────
  const confidencePassed = story.confidence_score >= CONFIDENCE_THRESHOLD;
  const confidenceDetail = confidencePassed
    ? `AI confidence score ${story.confidence_score.toFixed(2)} meets the threshold of ${CONFIDENCE_THRESHOLD}.`
    : `AI confidence score is ${story.confidence_score.toFixed(2)}, which is below the threshold of ${CONFIDENCE_THRESHOLD}. Manual review is required.`;
  checks.push({ rule: "CONFIDENCE_THRESHOLD", passed: confidencePassed, details: confidenceDetail });
  if (!confidencePassed) {
    warnings.push(confidenceDetail);
    flags.push("LOW_CONFIDENCE");
  }

  // ── Rule 4: Minimum acceptance criteria ──────────────────────────────────
  const acBlockCount = (story.acceptance_criteria.match(/^\d+\./gm) ?? []).length;
  const acPassed = acBlockCount >= MIN_AC_LINES;
  const acDetail = acPassed
    ? `${acBlockCount} acceptance criteria generated — meets the minimum of ${MIN_AC_LINES}.`
    : `Only ${acBlockCount} acceptance criterion was generated. At least ${MIN_AC_LINES} are required for a testable story.`;
  checks.push({ rule: "MINIMUM_AC", passed: acPassed, details: acDetail });
  if (!acPassed) {
    warnings.push(acDetail);
    flags.push("INSUFFICIENT_AC");
  }

  const uniqueFlags = [...new Set(flags)];

  return {
    passed: warnings.length === 0,
    warnings,
    flags: uniqueFlags,
    checks,
  };
}
