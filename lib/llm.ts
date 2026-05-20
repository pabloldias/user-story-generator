import axios, { AxiosError } from "axios";

const REQUESTY_API_KEY = process.env.REQUESTY_API_KEY;
const REQUESTY_BASE_URL = process.env.REQUESTY_BASE_URL ?? "https://router.requesty.ai/v1";
const REQUESTY_MODEL = process.env.REQUESTY_MODEL;

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

// ─── Error type ───────────────────────────────────────────────────────────────

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type LLMRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMCallOptions {
  /** Optional system-level instruction message placed before the user turn. */
  systemPrompt?: string;
  /** Temperature override (default: 0.2). */
  temperature?: number;
}

interface OpenAIChatCompletionResponse {
  choices: Array<{
    message: { content: string | null };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─── Variable interpolation ───────────────────────────────────────────────────

/**
 * Replaces all `{{key}}` placeholders in a prompt template with the
 * corresponding values from `variables`. Throws if any placeholder remains
 * after substitution (i.e. a required variable is missing).
 */
export function interpolatePrompt(template: string, variables: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }

  const unresolved = result.match(/\{\{[^}]+\}\}/g);
  if (unresolved) {
    throw new LLMError(
      `Prompt contains unresolved placeholders: ${unresolved.join(", ")}`,
    );
  }

  return result;
}

// ─── Core LLM caller ──────────────────────────────────────────────────────────

/**
 * Calls the Requesty (OpenAI-compatible) chat completions endpoint.
 *
 * - Accepts an optional `systemPrompt` for role-separated instructions.
 * - Enforces JSON output via `response_format: { type: "json_object" }`.
 * - Interpolates `{{key}}` placeholders in `userPrompt` from `variables`.
 * - Retries up to MAX_RETRIES times on 5xx / network errors with exponential
 *   back-off, then throws an `LLMError`.
 *
 * Returns an object with the raw JSON string and token usage for logging.
 */
export async function callLLM(
  userPrompt: string,
  variables: Record<string, string> = {},
  options: LLMCallOptions = {},
): Promise<{ content: string; usage?: OpenAIChatCompletionResponse["usage"] }> {
  if (!REQUESTY_API_KEY) throw new LLMError("REQUESTY_API_KEY is not configured.");
  if (!REQUESTY_MODEL) throw new LLMError("REQUESTY_MODEL is not configured.");

  const interpolated = interpolatePrompt(userPrompt, variables);

  const messages: LLMMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: interpolated });

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post<OpenAIChatCompletionResponse>(
        `${REQUESTY_BASE_URL}/chat/completions`,
        {
          model: REQUESTY_MODEL,
          messages,
          response_format: { type: "json_object" },
          temperature: options.temperature ?? 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${REQUESTY_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 60_000,
        },
      );

      const rawContent = response.data.choices?.[0]?.message?.content;
      if (!rawContent) throw new LLMError("LLM returned an empty response content.");

      // Strip markdown code fences (```json ... ``` or ``` ... ```) that some
      // models emit even when json_object response_format is requested.
      const content = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

      return { content, usage: response.data.usage };
    } catch (err) {
      lastError = err;

      const isRetryable =
        err instanceof AxiosError &&
        (err.code === "ECONNABORTED" ||
          err.code === "ECONNRESET" ||
          (err.response?.status !== undefined && err.response.status >= 500));

      if (!isRetryable || attempt === MAX_RETRIES) break;

      const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  if (lastError instanceof LLMError) throw lastError;
  throw new LLMError(`LLM call failed after ${MAX_RETRIES} attempts.`, lastError);
}
