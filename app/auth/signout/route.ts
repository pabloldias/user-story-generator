import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

/**
 * Sign-out route — clears the Supabase session and redirects to /login.
 */
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SUPABASE_URL));
}
