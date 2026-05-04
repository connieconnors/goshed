import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    console.error("[api/account/delete] SUPABASE_SERVICE_ROLE_KEY is missing or empty. Add it to .env.local (Supabase Dashboard → Settings → API → service_role key).");
    return NextResponse.json(
      { error: "Account deletion is not configured. Please contact support." },
      { status: 503 }
    );
  }

  const userId = user.id;
  const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : null;

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  // Delete user data (service role bypasses RLS)
  const { error: itemsError } = await adminClient.from("items").delete().eq("user_id", userId);
  if (itemsError) {
    console.error("[api/account/delete] items error:", itemsError);
    return NextResponse.json({ error: "Failed to delete account data" }, { status: 500 });
  }

  const { error: notesError } = await adminClient.from("life_notes").delete().eq("user_id", userId);
  if (notesError) {
    console.error("[api/account/delete] life_notes error:", notesError);
    return NextResponse.json({ error: "Failed to delete account data" }, { status: 500 });
  }

  const { error: invitesError } = await adminClient
    .from("shed_invites")
    .delete()
    .or(`owner_user_id.eq.${userId}${email ? `,invitee_email.eq.${email}` : ""}`);
  if (invitesError) {
    console.error("[api/account/delete] shed_invites error:", invitesError);
    return NextResponse.json({ error: "Failed to delete account data" }, { status: 500 });
  }

  if (email) {
    const { error: passwordHintError } = await adminClient
      .from("user_password_set")
      .delete()
      .eq("email", email);
    if (passwordHintError) {
      console.error("[api/account/delete] user_password_set error:", passwordHintError);
      return NextResponse.json({ error: "Failed to delete account data" }, { status: 500 });
    }
  }

  const { error: profileError } = await adminClient.from("users").delete().eq("id", userId);
  if (profileError) {
    console.error("[api/account/delete] users error:", profileError);
    return NextResponse.json({ error: "Failed to delete account data" }, { status: 500 });
  }

  const { error: userError } = await adminClient.auth.admin.deleteUser(userId);
  if (userError) {
    console.error("[api/account/delete] auth delete error:", userError);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
