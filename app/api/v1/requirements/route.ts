import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/mcp-auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

// ─── GET /api/v1/requirements ─────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { user, error } = await authenticateRequest(req);
  if (error || !user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  const status = searchParams.get("status");

  const supabase = getAdminClient();
  let query = supabase.from("requirements").select("*").order("created_at", { ascending: false });
  if (project_id) query = query.eq("project_id", project_id);
  if (status) query = query.eq("status", status);

  const { data, error: dbError } = await query;
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}
