import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

/**
 * Record that the current user has set a password (DB + login hint table).
 * Updates public.users so state persists across devices and powers /api/auth/has-password.
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

  const rowUpdate = {
    has_password_set: true,
    skipped_password_at: null as string | null,
    welcome_sent: true,
  };

  const { error: usersErr } = await supabase.from("users").update(rowUpdate).eq("id", user.id);

  if (usersErr) {
    console.error("[api/auth/password-set] users update:", usersErr.message);
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (serviceRoleKey) {
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
        auth: { persistSession: false },
      });
      const { error: adminUsersErr } = await admin.from("users").update(rowUpdate).eq("id", user.id);
      if (adminUsersErr) {
        console.error("[api/auth/password-set] admin users update:", adminUsersErr);
        return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
    }
  }

  const { error: upsertError } = await supabase
    .from("user_password_set")
    .upsert({ email, set_at: new Date().toISOString() }, { onConflict: "email" });

  if (upsertError) {
    console.error("[api/auth/password-set] user_password_set:", upsertError);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
