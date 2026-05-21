// ─── Human-readable flag descriptions ─────────────────────────────────────────
// Used in StoryCard (requirement view) and the story detail page.

const FLAG_LABELS: Record<string, { title: string; description: string }> = {
  VAGUE_GOAL: {
    title: "Vague goal",
    description:
      'The requirement goal uses non-specific language (e.g. "make it better", "improve", "more useful"). A developer cannot implement this without clarification.',
  },
  NULL_ENTITY: {
    title: "Missing entity",
    description:
      "One or more of the three required entities (actor, goal, or value) could not be found in the original input.",
  },
  INVALID_TEMPLATE: {
    title: "Invalid story format",
    description:
      'The generated story body does not follow the required "As a [actor], I want [goal], so that [value]." format.',
  },
  MISSING_FIELDS: {
    title: "Missing fields",
    description:
      "Required fields could not be extracted from the input. The story contains unfilled [MISSING: \u2026] placeholders.",
  },
  LOW_CONFIDENCE: {
    title: "Low confidence",
    description:
      "The AI confidence score is below the required threshold. This story should be reviewed and regenerated with a more detailed requirement.",
  },
  INSUFFICIENT_AC: {
    title: "Insufficient acceptance criteria",
    description:
      "Fewer than 2 acceptance criteria were generated. The requirement was too vague to produce a testable story.",
  },
  NO_ACCEPTANCE_CRITERIA: {
    title: "No acceptance criteria",
    description: "No acceptance criteria could be derived from the provided input.",
  },
  NO_MEASURABLE_OUTCOME: {
    title: "No measurable outcome",
    description:
      "The goal does not describe a concrete, measurable outcome. Add specific success criteria to the requirement.",
  },
};

export function getFlagLabel(flag: string): { title: string; description: string } {
  return (
    FLAG_LABELS[flag] ?? {
      title: flag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: "This flag was raised during story generation or validation.",
    }
  );
}
