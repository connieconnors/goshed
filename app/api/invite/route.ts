import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { inviteeEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const inviteeEmail = typeof body.inviteeEmail === "string" ? body.inviteeEmail.trim().toLowerCase() : "";
  if (!inviteeEmail || !inviteeEmail.includes("@")) {
    return NextResponse.json({ error: "Valid invitee email required" }, { status: 400 });
  }

  const ownerEmail = user.email ?? "";
  const { data: row, error: insertError } = await supabase
    .from("shed_invites")
    .insert({
      owner_user_id: user.id,
      owner_email: ownerEmail || null,
      invitee_email: inviteeEmail,
      status: "pending",
    })
    .select("token")
    .single();

  if (insertError) {
    console.error("[api/invite] insert error:", insertError);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  const token = row?.token;
  if (!token) {
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
