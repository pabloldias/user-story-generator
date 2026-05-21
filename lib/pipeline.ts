import { readFile } from "fs/promises";
import path from "path";
import { callLLM, LLMError } from "./llm";
import {
  StorySplitSchema,
  EntityExtractionSchema,
  UserStoryGenerationSchema,
  AcceptanceCriteriaSchema,
  type StorySplit,
  type EntityExtraction,
  type UserStoryGeneration,
  type AcceptanceCriterion,
  type PipelineResult,
} from "./schemas";

// ─── Vagueness patterns ───────────────────────────────────────────────────────
// Phrases that indicate an entity is present in text but carries no concrete,
// actionable meaning. Any match hard-caps the confidence score.
const VAGUE_GOAL_PATTERNS = [
  /\bbetter\b/i,
  /\bmore useful\b/i,
  /\bless confusing\b/i,
  /\beasier\b/i,
  /\bimprove\b/i,
  /\bnicer\b/i,
  /\bcleaner\b/i,
  /\bfix (?:the |it|things|issues|problems|stuff)\b/i,
  /\bright stuff\b/i,
  /\bmore intuitive\b/i,
  /\buser.friendly\b/i,
  /\benhance\b/i,
  /\boptimize\b/i,
  /\bsomething\b/i,
  /\bstuff\b/i,
];

/**
 * Deterministically caps the LLM's self-reported confidence score based on
 * objective signals extracted from the entity extraction step.
 *
 * The LLM is instructed to self-calibrate, but this provides a hard safety net
 * so that structurally ambiguous inputs can never score above their quality band.
 *
 * Band ceilings:
 *   0.15 — one or more entity is null
 *   0.30 — goal is present but matches a vagueness pattern
 *   1.00 — no structural defect detected; LLM score is accepted as-is
 */
function capConfidenceScore(
  llmScore: number,
  entities: EntityExtraction,
): { score: number; cappedBy: string | null } {
  // Band 1: null entity
  if (entities.actor === null || entities.goal === null || entities.value === null) {
    const capped = Math.min(llmScore, 0.15);
    return { score: capped, cappedBy: "NULL_ENTITY" };
  }

  // Band 2: goal is vague / non-actionable
  const goalIsVague = VAGUE_GOAL_PATTERNS.some((re) => re.test(entities.goal ?? ""));
  if (goalIsVague) {
    const capped = Math.min(llmScore, 0.30);
    return { score: capped, cappedBy: "VAGUE_GOAL" };
  }

  return { score: llmScore, cappedBy: null };
}

// ─── Prompt loader ────────────────────────────────────────────────────────────

async function loadPrompt(filename: string): Promise<string> {
  const promptPath = path.join(process.cwd(), "prompts", filename);
  return readFile(promptPath, "utf-8");
}

// ─── LLM call logger ─────────────────────────────────────────────────────────

/**
 * Logs an LLM call to stdout (server logs / Vercel log drain) in a structured
 * JSON line. Replace with a Supabase insert in a future iteration to satisfy
 * "log raw LLM responses for traceability" (Phase 5 task 5).
 */
function logLLMCall(
  step: string,
  rawContent: string,
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
): void {
  console.log(
    JSON.stringify({
      level: "info",
      source: "pipeline",
      step,
      timestamp: new Date().toISOString(),
      usage: usage ?? null,
      raw_content_length: rawContent.length,
    }),
  );
}

// ─── System prompts ───────────────────────────────────────────────────────────
// Each step gets a focused system role instruction so the model stays in
// character for its part of the pipeline and is less likely to deviate.

const SYSTEM_STORY_SPLITTING = `You are a senior Agile coach. Your only job is to determine whether a business requirement should be split into multiple independent user stories. You apply the single-responsibility principle strictly. You always return valid JSON.`;

const SYSTEM_ENTITY_EXTRACTION = `You are a senior requirements analyst. Your only job is to extract entities from business requirements exactly as stated. You never infer, guess, or add information. You always return valid JSON.`;

const SYSTEM_STORY_GENERATION = `You are a certified Agile product analyst. Your only job is to write Jira-formatted user stories from the provided entities. You never add information beyond what you are given. You always return valid JSON.`;

const SYSTEM_ACCEPTANCE_CRITERIA = `You are a senior QA analyst. Your only job is to write testable Given/When/Then acceptance criteria derived strictly from the user story provided. You never invent requirements. You always return valid JSON.`;

// ─── Step 0: Story Splitting ──────────────────────────────────────────────────

/**
 * Determines whether a raw requirement should be split into multiple
 * independent sub-requirements. Returns the list of sub-requirements to
 * process (either the original input unchanged, or 2–5 focused slices).
 */
export async function splitRequirement(rawInput: string): Promise<StorySplit> {
  const prompt = await loadPrompt("story-splitting.txt");

  const { content: raw, usage } = await callLLM(
    prompt,
    { input: rawInput },
    { systemPrompt: SYSTEM_STORY_SPLITTING },
  );

  logLLMCall("story_splitting", raw, usage);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LLMError(`Story splitting returned invalid JSON: ${raw}`);
  }

  const result = StorySplitSchema.safeParse(parsed);
  if (!result.success) {
    throw new LLMError(
      `Story splitting schema validation failed: ${result.error.message}`,
    );
  }

  return result.data;
}

// ─── Step 1: Entity Extraction ────────────────────────────────────────────────

/**
 * Extracts actor, goal, and value entities from a raw requirement string.
 * Returns null fields for any entity not explicitly present in the input.
 */
export async function extractEntities(rawInput: string): Promise<EntityExtraction> {
  const prompt = await loadPrompt("entity-extraction.txt");

  const { content: raw, usage } = await callLLM(
    prompt,
    { input: rawInput },
    { systemPrompt: SYSTEM_ENTITY_EXTRACTION },
  );

  logLLMCall("entity_extraction", raw, usage);

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

  const { content: raw, usage } = await callLLM(
    prompt,
    { entities: entitiesText },
    { systemPrompt: SYSTEM_STORY_GENERATION },
  );

  logLLMCall("story_generation", raw, usage);

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
 *
 * The prompt returns `{"criteria":[…]}` — a JSON object wrapping the array —
 * so json_object mode is always satisfied without any brittle hacks.
 */
export async function generateAcceptanceCriteria(
  storyBody: string,
): Promise<AcceptanceCriterion[]> {
  const prompt = await loadPrompt("acceptance-criteria.txt");

  const { content: raw, usage } = await callLLM(
    prompt,
    { story: storyBody },
    { systemPrompt: SYSTEM_ACCEPTANCE_CRITERIA },
  );

  logLLMCall("acceptance_criteria", raw, usage);

  let parsed: unknown;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    // Expect {"criteria": [...]} from the refined prompt.
    // Fall back to the root object being an array for backwards compatibility.
    parsed = Array.isArray(obj) ? obj : (obj.criteria ?? obj.items ?? obj);
  } catch {
    throw new LLMError(`Acceptance criteria returned invalid JSON: ${raw}`);
  }

  // Allow an empty array from the LLM — the INSUFFICIENT_AC guardrail will flag
  // it. We only throw if the structure is completely wrong (not an array).
  const arrayResult = AcceptanceCriteriaSchema.safeParse(parsed);
  if (arrayResult.success) {
    return arrayResult.data;
  }

  // If the only problem is the array being empty, return the placeholder so the
  // story is still stored and the guardrail fires correctly.
  const isEmptyArray = Array.isArray(parsed) && (parsed as unknown[]).length === 0;
  if (isEmptyArray) {
    console.warn("[pipeline] Acceptance criteria: LLM returned empty array — using placeholder.");
    return [
      {
        given: "[MISSING: acceptance criteria — the input was too ambiguous for the LLM to generate testable criteria]",
        when: "the user attempts to use the feature",
        then: "the expected outcome is undefined — manual review required",
      },
    ];
  }

  throw new LLMError(
    `Acceptance criteria schema validation failed: ${arrayResult.error.message}`,
  );
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

// ─── Single-requirement pipeline ─────────────────────────────────────────────

/**
 * Runs the 3-step AI pipeline for a single, focused sub-requirement:
 * 1. Entity extraction
 * 2. User story generation (includes metadata)
 * 3. Acceptance criteria generation
 *
 * Returns a `PipelineResult` ready to be validated by guardrails and stored
 * in the database.
 */
async function runSinglePipeline(subInput: string): Promise<PipelineResult> {
  // Step 1 — extract entities
  const entities = await extractEntities(subInput);

  // Step 2 — generate story + metadata
  const story = await generateStory(entities);

  // Step 2b — deterministically cap the LLM's self-reported confidence score
  // based on objective entity quality signals (null fields, vague goals).
  const { score: calibratedScore, cappedBy } = capConfidenceScore(
    story.confidence_score,
    entities,
  );

  const calibratedFlags = cappedBy
    ? [...new Set([...story.flags, cappedBy])]
    : story.flags;

  if (cappedBy) {
    console.log(
      JSON.stringify({
        level: "warn",
        source: "pipeline",
        step: "confidence_calibration",
        timestamp: new Date().toISOString(),
        llm_score: story.confidence_score,
        calibrated_score: calibratedScore,
        cap_reason: cappedBy,
      }),
    );
  }

  // Step 3 — generate acceptance criteria
  const criteria = await generateAcceptanceCriteria(story.story_body);

  return {
    title: story.title,
    story_body: story.story_body,
    acceptance_criteria: serialiseAC(criteria),
    priority: story.priority,
    story_points: story.story_points,
    labels: story.labels,
    confidence_score: calibratedScore,
    flags: calibratedFlags,
  };
}

// ─── Pipeline orchestrator ────────────────────────────────────────────────────

/**
 * Runs the full AI pipeline for a raw requirement:
 *
 * Step 0 — Story splitting: determines if the requirement should produce
 *           multiple independent user stories (different actors / independent
 *           features). Returns 1–5 focused sub-requirements.
 *
 * Steps 1–3 — For each sub-requirement: entity extraction → story generation
 *             → acceptance criteria generation.
 *
 * Returns an array of `PipelineResult` objects (one per story). Single-story
 * requirements return a one-element array so all callers can be uniform.
 */
export async function runPipeline(rawInput: string): Promise<PipelineResult[]> {
  // Step 0 — split requirement into independent sub-requirements (if needed)
  const split = await splitRequirement(rawInput);

  console.log(
    JSON.stringify({
      level: "info",
      source: "pipeline",
      step: "story_splitting",
      timestamp: new Date().toISOString(),
      should_split: split.should_split,
      story_count: split.sub_requirements.length,
    }),
  );

  // Steps 1–3 — run the single-story pipeline for every sub-requirement.
  // We process them sequentially to avoid hammering the LLM rate limit.
  const results: PipelineResult[] = [];
  for (const subInput of split.sub_requirements) {
    const result = await runSinglePipeline(subInput);
    results.push(result);
  }

  return results;
}
