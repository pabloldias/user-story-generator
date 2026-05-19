import { z } from "zod";

// ─── Entity Extraction ────────────────────────────────────────────────────────

export const EntityExtractionSchema = z.object({
  actor: z.string().nullable(),
  goal: z.string().nullable(),
  value: z.string().nullable(),
  missing_fields: z.array(z.enum(["actor", "goal", "value"])).default([]),
});

export type EntityExtraction = z.infer<typeof EntityExtractionSchema>;

// ─── User Story Generation ────────────────────────────────────────────────────

const PriorityEnum = z.enum(["Low", "Medium", "High", "Critical"]);

const StoryPointsEnum = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(5),
  z.literal(8),
  z.literal(13),
]);

export const UserStoryGenerationSchema = z.object({
  title: z.string().min(1),
  story_body: z.string().min(1),
  priority: PriorityEnum,
  story_points: StoryPointsEnum,
  labels: z.array(z.string()).default([]),
  confidence_score: z.number().min(0).max(1),
  flags: z.array(z.string()).default([]),
});

export type UserStoryGeneration = z.infer<typeof UserStoryGenerationSchema>;

// ─── Acceptance Criteria ──────────────────────────────────────────────────────

export const AcceptanceCriterionSchema = z.object({
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.string().min(1),
});

export const AcceptanceCriteriaSchema = z.array(AcceptanceCriterionSchema).min(1).max(5);

export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

// ─── Pipeline Result (assembled from all steps) ───────────────────────────────

export interface PipelineResult {
  title: string;
  story_body: string;
  /** Serialised acceptance criteria in Given/When/Then format */
  acceptance_criteria: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  story_points: 1 | 2 | 3 | 5 | 8 | 13;
  labels: string[];
  confidence_score: number;
  flags: string[];
}
