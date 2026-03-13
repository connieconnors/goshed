import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Check if an account with this email has set a password (so login can show password field).
 * Returns only { hasPassword: boolean } so we don't leak whether the email exists.
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim()?.toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ hasPassword: false });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    return NextResponse.json({ hasPassword: false });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  const { data, error } = await admin
    .from("user_password_set")
    .select("email")
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[api/auth/has-password]", error);
    return NextResponse.json({ hasPassword: false });
  }

  return NextResponse.json({ hasPassword: !!data });
}
