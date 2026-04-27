import { createSupabaseServerClient } from "@/lib/supabase-server";
import { hasProEntitlement } from "@/lib/revenuecat";
import { NextResponse } from "next/server";

/**
 * Returns the current auth session from server-readable cookies.
 * Use this so the client can know if the user is signed in after redirect from the sign-in link,
 * since the browser client may not see the session cookie immediately.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    return NextResponse.json({ user: null, itemCount: null, isPro: false, code: null, welcomeSent: null });
  }
  if (!user) {
    return NextResponse.json({ user: null, itemCount: null, isPro: false, code: null, welcomeSent: null });
  }

  const { count, error: countError } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("hidden", false);

  const itemCount = !countError && count !== null ? count : 0;
  const isPro = await hasProEntitlement(user.id);

  let code: string | null = null;
  let welcomeSent = true;
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("code, welcome_sent")
    .eq("id", user.id)
    .maybeSingle();
  if (!profileError && profile) {
    const c = profile.code;
    if (c !== undefined && c !== null && String(c).trim() !== "") {
      code = String(c).trim();
    }
    welcomeSent = profile.welcome_sent === true;
  }

  return NextResponse.json({ user, itemCount, isPro, code, welcomeSent });
}
