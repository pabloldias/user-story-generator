import { readFile } from "fs/promises";
import path from "path";
import { callLLM, LLMError } from "./llm";
import {
  EntityExtractionSchema,
  UserStoryGenerationSchema,
  AcceptanceCriteriaSchema,
  type EntityExtraction,
  type UserStoryGeneration,
  type AcceptanceCriterion,
  type PipelineResult,
} from "./schemas";

// ─── Prompt loader ────────────────────────────────────────────────────────────

async function loadPrompt(filename: string): Promise<string> {
  const promptPath = path.join(process.cwd(), "prompts", filename);
  return readFile(promptPath, "utf-8");
}

// ─── Step 1: Entity Extraction ────────────────────────────────────────────────

/**
 * Extracts actor, goal, and value entities from a raw requirement string.
 * Returns null fields for any entity not explicitly present in the input.
 */
export async function extractEntities(rawInput: string): Promise<EntityExtraction> {
  const prompt = await loadPrompt("entity-extraction.txt");

  const raw = await callLLM(prompt, { input: rawInput });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LLMError(`Entity extraction returned invalid JSON: ${raw}`);
  }

  const result = EntityExtractionSchema.safeParse(parsed);
  if (!result.success) {
    throw new LLMError(
      `Entity extraction schema validation failed: ${result.error.message}`,
    );
  }

  return result.data;
}

// ─── Step 2: User Story Generation ───────────────────────────────────────────

/**
 * Generates a structured user story from the extracted entities.
 * Returns title, story_body, priority, story_points, labels, confidence_score,
 * and any flags for missing or ambiguous fields.
 */
export async function generateStory(entities: EntityExtraction): Promise<UserStoryGeneration> {
  const prompt = await loadPrompt("user-story-generation.txt");

  const entitiesText = JSON.stringify(entities, null, 2);
  const raw = await callLLM(prompt, { entities: entitiesText });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LLMError(`User story generation returned invalid JSON: ${raw}`);
  }

  const result = UserStoryGenerationSchema.safeParse(parsed);
  if (!result.success) {
    throw new LLMError(
      `User story generation schema validation failed: ${result.error.message}`,
    );
  }

  return result.data;
}

// ─── Step 3: Acceptance Criteria Generation ───────────────────────────────────

/**
 * Generates 2–5 acceptance criteria in Given/When/Then format for a story.
 */
export async function generateAcceptanceCriteria(
  storyBody: string,
): Promise<AcceptanceCriterion[]> {
  const prompt = await loadPrompt("acceptance-criteria.txt");

  const raw = await callLLM(prompt, { story: storyBody });

  let parsed: unknown;
  try {
    // The AC prompt returns a bare JSON array; wrap it in an object so
    // json_object mode is satisfied, then unwrap.
    const maybeWrapped = raw.trim().startsWith("[") ? `{"items":${raw}}` : raw;
    const obj = JSON.parse(maybeWrapped) as Record<string, unknown>;
    parsed = Array.isArray(obj) ? obj : (obj.items ?? obj);
  } catch {
    throw new LLMError(`Acceptance criteria returned invalid JSON: ${raw}`);
  }

  const result = AcceptanceCriteriaSchema.safeParse(parsed);
  if (!result.success) {
    throw new LLMError(
      `Acceptance criteria schema validation failed: ${result.error.message}`,
    );
  }

  return result.data;
}

// ─── Serialiser ───────────────────────────────────────────────────────────────

/**
 * Converts structured acceptance criteria into a readable Given/When/Then
 * string suitable for storing in the `acceptance_criteria` text column.
 */
function serialiseAC(criteria: AcceptanceCriterion[]): string {
  return criteria
    .map(
      (c, i) =>
        `${i + 1}. Given ${c.given}\n   When ${c.when}\n   Then ${c.then}`,
    )
    .join("\n\n");
}

// ─── Pipeline orchestrator ────────────────────────────────────────────────────

/**
 * Runs the full 3-step AI pipeline sequentially:
 * 1. Entity extraction
 * 2. User story generation (includes metadata)
 * 3. Acceptance criteria generation
 *
 * Returns a `PipelineResult` ready to be validated by guardrails and stored
 * in the database.
 */
export async function runPipeline(rawInput: string): Promise<PipelineResult> {
  // Step 1 — extract entities
  const entities = await extractEntities(rawInput);

  // Step 2 — generate story + metadata
  const story = await generateStory(entities);

  // Step 3 — generate acceptance criteria
  const criteria = await generateAcceptanceCriteria(story.story_body);

  return {
    title: story.title,
    story_body: story.story_body,
    acceptance_criteria: serialiseAC(criteria),
    priority: story.priority,
    story_points: story.story_points,
    labels: story.labels,
    confidence_score: story.confidence_score,
    flags: story.flags,
  };
}
