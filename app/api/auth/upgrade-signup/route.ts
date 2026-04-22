import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isAlreadyRegisteredAdminMessage(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("user already registered") ||
    m.includes("duplicate")
  );
}

/**
 * Upgrade paywall: create a fully confirmed auth user (bypasses project email confirmation).
 * Client must call signInWithPassword afterward to attach a browser session.
 */
export async function POST(request: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email.includes("@") || password.length < 6) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (isAlreadyRegisteredAdminMessage(error.message)) {
      return NextResponse.json({ code: "already_registered" as const }, { status: 409 });
    }
    console.error("[upgrade-signup] admin.createUser:", error.message);
    return NextResponse.json({ error: error.message || "Could not create account" }, { status: 400 });
  }

  const uid = data.user?.id ?? null;
  const userEmail = (data.user?.email ?? email).trim().toLowerCase();
  if (!uid || !userEmail.includes("@")) {
    return NextResponse.json({ error: "Account created but user id missing" }, { status: 500 });
  }

  /** Same profile flags as POST /api/auth/password-set (no session on this request, so apply via admin). */
  const rowUpdate = {
    has_password_set: true,
    skipped_password_at: null as string | null,
    welcome_sent: true,
  };

  const { error: usersErr } = await admin.from("users").upsert(
    {
      id: uid,
      email: userEmail,
      ...rowUpdate,
    },
    { onConflict: "id" }
  );

  if (usersErr) {
    console.error("[upgrade-signup] users upsert (password-set equivalent):", usersErr.message);
    return NextResponse.json({ error: "Account created but profile could not be saved." }, { status: 500 });
  }

  const { error: upsertHintErr } = await admin
    .from("user_password_set")
    .upsert({ email: userEmail, set_at: new Date().toISOString() }, { onConflict: "email" });

  if (upsertHintErr) {
    console.error("[upgrade-signup] user_password_set upsert:", upsertHintErr.message);
    return NextResponse.json({ error: "Account created but profile could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, userId: uid });
}
