import { NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Authenticates an incoming request either via:
 *   1. A valid `x-mcp-api-key` header matching MCP_API_KEY env var (returns an
 *      admin Supabase client that bypasses RLS).
 *   2. The normal Supabase session cookie (standard user flow).
 *
 * Returns `{ supabase, user, isMcp }` on success, or `{ error }` when
 * authentication fails.
 */
export async function authenticateRequest(req: NextRequest) {
  // ── MCP service-key path ────────────────────────────────────────────────────
  const mcpApiKey = process.env.MCP_API_KEY;
  const incomingKey = req.headers.get("x-mcp-api-key");

  if (mcpApiKey && incomingKey && incomingKey === mcpApiKey) {
    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
    );

    // Return a synthetic user so callers don't need to special-case the shape.
    return {
      supabase,
      user: { id: "mcp-service", email: "mcp@internal" },
      isMcp: true,
      error: null,
    };
  }

  // ── Normal session-cookie path ──────────────────────────────────────────────
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase: null, user: null, isMcp: false, error: "Unauthorized." };
  }

  return { supabase, user, isMcp: false, error: null };
}
