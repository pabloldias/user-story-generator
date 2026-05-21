import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/mcp-auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

// ─── GET /api/v1/stories/[id] ─────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { user, error } = await authenticateRequest(req);
  if (error || !user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const supabase = getAdminClient();
  const { data, error: dbError } = await supabase
    .from("user_stories")
    .select("*")
    .eq("id", id)
    .single();

  if (dbError || !data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(data);
}

// ─── PATCH /api/v1/stories/[id] ───────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { user, error } = await authenticateRequest(req);
  if (error || !user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data, error: dbError } = await supabase
    .from("user_stories")
    .update({ ...(body as Record<string, unknown>), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (dbError || !data)
    return NextResponse.json({ error: dbError?.message ?? "Not found." }, { status: 500 });
  return NextResponse.json(data);
}
