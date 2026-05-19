import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Lightweight liveness check. Returns the configured LLM model and the
 * current timestamp so callers can confirm the API layer is up and the
 * environment is wired correctly without making a real LLM call.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    llm_model: process.env.REQUESTY_MODEL ?? null,
    llm_base_url: process.env.REQUESTY_BASE_URL ?? "https://router.requesty.ai/v1",
    environment: process.env.NODE_ENV,
  });
}
