import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Please copy .env.local.example to .env.local and fill in the values.",
  );
}

/**
 * Browser client — use this in Client Components ("use client").
 * Uses the publishable key (new Supabase API key model, replaces anon key).
 * Creates a new instance per call (memoised internally by @supabase/ssr).
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
