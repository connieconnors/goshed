import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Whether the signed-in user should see the password onboarding modal.
 * Auth required; returns { eligible: false } when not signed in.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ eligible: false });
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("has_password_set, skipped_password_at, welcome_sent")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[password-onboarding-eligible]", profileError);
    return NextResponse.json({ eligible: false });
  }

  if (!profile) {
    return NextResponse.json({ eligible: true });
  }

  if (profile.has_password_set === true) {
    return NextResponse.json({ eligible: false });
  }

  // Legacy: completed onboarding before skipped_password_at existed (welcome_sent only).
  if (profile.welcome_sent === true && profile.skipped_password_at == null) {
    return NextResponse.json({ eligible: false });
  }

  const skipped = profile.skipped_password_at;
  if (skipped) {
    const elapsed = Date.now() - new Date(skipped).getTime();
    if (elapsed < THIRTY_DAYS_MS) {
      return NextResponse.json({ eligible: false });
    }
  }

  return NextResponse.json({ eligible: true });
}
