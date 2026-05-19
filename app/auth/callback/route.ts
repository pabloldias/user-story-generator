import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

/**
 * Auth callback route — Supabase redirects here after email confirmation.
 * Exchanges the one-time code for a session and redirects the user home.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong — redirect to an error page
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
