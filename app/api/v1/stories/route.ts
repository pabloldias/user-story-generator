import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/mcp-auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

// ─── GET /api/v1/stories ──────────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { user, error } = await authenticateRequest(req);
  if (error || !user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requirement_id = searchParams.get("requirement_id");
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");

  const supabase = getAdminClient();
  let query = supabase.from("user_stories").select("*").order("created_at", { ascending: false });
  if (requirement_id) query = query.eq("requirement_id", requirement_id);
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);

  const { data, error: dbError } = await query;
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}
