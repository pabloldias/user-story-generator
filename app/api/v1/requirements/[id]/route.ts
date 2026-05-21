import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/mcp-auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

// ─── GET /api/v1/requirements/[id] ───────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { user, error } = await authenticateRequest(req);
  if (error || !user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const supabase = getAdminClient();
  const { data, error: dbError } = await supabase
    .from("requirements")
    .select("*")
    .eq("id", id)
    .single();

  if (dbError || !data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(data);
}
