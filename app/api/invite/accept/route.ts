import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token?.trim()) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 503 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  const { data: invite, error: inviteError } = await supabase
    .from("shed_invites")
    .select("id, owner_user_id, owner_email, status")
    .eq("token", token)
    .single();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.status !== "pending") {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("shed_invites")
    .update({ status: "accepted" })
    .eq("id", invite.id);

  if (updateError) {
    console.error("[api/invite/accept] update error:", updateError);
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
  }

  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select("id, photo_url, item_label, recommendation, value_range_raw, value_low, value_high, status, created_at")
    .eq("user_id", invite.owner_user_id)
    .order("created_at", { ascending: false });

  if (itemsError) {
    console.error("[api/invite/accept] items error:", itemsError);
    return NextResponse.json(
      {
        ownerUserId: invite.owner_user_id,
        ownerEmail: invite.owner_email ?? "",
        items: [],
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ownerUserId: invite.owner_user_id,
    ownerEmail: invite.owner_email ?? "",
    items: items ?? [],
  });
}
