import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("users").update({ welcome_sent: true }).eq("id", user.id);
  if (!error) {
    return NextResponse.json({ ok: true });
  }

  console.error("[welcome-shown] user-scoped update failed:", error.message);

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRoleKey) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { error: adminErr } = await admin.from("users").update({ welcome_sent: true }).eq("id", user.id);
    if (!adminErr) {
      return NextResponse.json({ ok: true });
    }
    console.error("[welcome-shown] admin update error:", adminErr);
  }

  return NextResponse.json({ error: "Failed to update" }, { status: 500 });
}
