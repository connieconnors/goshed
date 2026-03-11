import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * Returns the current auth session from server-readable cookies.
 * Use this so the client can know if the user is signed in after redirect from magic link,
 * since the browser client may not see the session cookie immediately.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user: user ?? null });
}
