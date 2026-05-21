import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/mcp-auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

// ─── POST /api/v1/stories/[id]/reject ────────────────────────────────────────
export async function POST(
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

  const { feedback } = body as Record<string, unknown>;
  if (!feedback || typeof feedback !== "string" || feedback.length < 10) {
    return NextResponse.json(
      { error: "feedback must be at least 10 characters." },
      { status: 422 },
    );
  }

  const supabase = getAdminClient();

  // 1. Set story to needs_changes and get requirement_id
  const { data: story, error: storyError } = await supabase
    .from("user_stories")
    .update({ status: "needs_changes", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("requirement_id")
    .single();

  if (storyError || !story) {
    return NextResponse.json({ error: storyError?.message ?? "Story not found." }, { status: 500 });
  }

  // 2. Persist feedback on the requirement
  await supabase
    .from("requirements")
    .update({ rejection_feedback: feedback })
    .eq("id", (story as { requirement_id: string }).requirement_id);

  return NextResponse.json({
    story_id: id,
    requirement_id: (story as { requirement_id: string }).requirement_id,
    status: "needs_changes",
    feedback,
  });
}
