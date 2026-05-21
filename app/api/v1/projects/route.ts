import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/mcp-auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

// ─── GET /api/v1/projects — list all projects ─────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { user, error } = await authenticateRequest(req);
  if (error || !user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const supabase = getAdminClient();
  const { data, error: dbError } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── POST /api/v1/projects — create a project ────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, error } = await authenticateRequest(req);
  if (error || !user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { name, description, user_id } = body as Record<string, unknown>;
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required." }, { status: 422 });
  }
  if (!user_id || typeof user_id !== "string") {
    return NextResponse.json({ error: "user_id is required." }, { status: 422 });
  }

  const supabase = getAdminClient();
  const { data, error: dbError } = await supabase
    .from("projects")
    .insert({ name, description: description ?? null, user_id })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
