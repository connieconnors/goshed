import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Record that the current user has set a password.
 * Called from account page after successful updateUser({ password }).
 * Used so the login page can show the password option on any device (not just localStorage).
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const email = user.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { error: upsertError } = await supabase
    .from("user_password_set")
    .upsert({ email, set_at: new Date().toISOString() }, { onConflict: "email" });

  if (upsertError) {
    console.error("[api/auth/password-set]", upsertError);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
