import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "GoShed <support@goshed.app>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://goshed.app";

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

  const joinUrl = `${APP_URL}/join?token=${encodeURIComponent(token)}`;
  const html = `
    <p>${ownerEmail || "A GoShed user"} invited you to their GoShed.</p>
    <p>They're sorting through some things and would love your help deciding what to keep, sell, donate, or let go.</p>
    <p>No account needed — just click the link below.</p>
    <p><a href="${joinUrl}">View their shed →</a></p>
    <p style="color:#888;font-size:12px;">P.S. This link is just for you. It won't ask you to sign up or download anything.</p>
  `;

  const { error: sendError } = await resend.emails.send({
    from: FROM,
    to: inviteeEmail,
    subject: `${ownerEmail || "Someone"} is sharing their GoShed with you`,
    html,
  });

  if (sendError) {
    console.error("[api/invite] Resend error:", sendError);
    return NextResponse.json({ error: "Failed to send invite email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
