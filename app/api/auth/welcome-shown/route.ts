import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

async function parseSkipFlag(request: NextRequest): Promise<boolean> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return false;
  try {
    const body = (await request.json()) as { skipPasswordOnboarding?: unknown };
    return body?.skipPasswordOnboarding === true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const skipPasswordOnboarding = await parseSkipFlag(request);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const patch = skipPasswordOnboarding
    ? {
        welcome_sent: true,
        has_password_set: false,
        skipped_password_at: nowIso,
      }
    : { welcome_sent: true };

  const { error } = await supabase.from("users").update(patch).eq("id", user.id);
  if (!error) {
    return NextResponse.json({ ok: true });
  }

  console.error("[welcome-shown] user-scoped update failed:", error.message);

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRoleKey) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { error: adminErr } = await admin.from("users").update(patch).eq("id", user.id);
    if (!adminErr) {
      return NextResponse.json({ ok: true });
    }
    console.error("[welcome-shown] admin update error:", adminErr);
  }

  return NextResponse.json({ error: "Failed to update" }, { status: 500 });
}
