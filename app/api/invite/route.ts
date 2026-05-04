import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
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

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[api/invite] RESEND_API_KEY missing; invite row created but email not sent");
    return NextResponse.json({ error: "Invite created, but email is not configured." }, { status: 500 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
    request.nextUrl.origin;
  const inviteUrl = `${baseUrl}/join?token=${encodeURIComponent(token)}`;
  const ownerName = ownerEmail ? ownerEmail.split("@")[0] : "Someone";
  const resend = new Resend(apiKey);
  const { error: sendError } = await resend.emails.send({
    from: "GoShed <support@goshed.app>",
    to: inviteeEmail,
    subject: `${ownerName} shared a GoShed with you`,
    html: `
      <div style="font-family:Georgia,serif;color:#2C2416;line-height:1.5;font-size:16px">
        <p>Hi,</p>
        <p>${escapeHtml(ownerName)} invited you to look through their GoShed and help decide what to sell, donate, gift, keep, or clear.</p>
        <p><a href="${escapeHtml(inviteUrl)}" style="color:#5E7155;font-weight:600">View the shared Shed</a></p>
        <p style="font-size:13px;color:#6B5B45">You can come back to this link later unless the invite is revoked.</p>
        <p style="font-size:13px;color:#6B5B45">If the button does not work, copy and paste this link:<br />${escapeHtml(inviteUrl)}</p>
        <p style="color:#5E7155">— GoShed</p>
      </div>
    `,
  });

  if (sendError) {
    console.error("[api/invite] Resend error:", sendError);
    return NextResponse.json({ error: "Invite created, but email could not be sent." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, emailSent: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
