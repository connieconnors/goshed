import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function formatCheckInDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { itemId?: string; itemName?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
  const itemName =
    typeof body.itemName === "string" && body.itemName.trim().length > 0
      ? body.itemName.trim()
      : "your item";
  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  const sessionEmail =
    typeof user.email === "string" && user.email.trim().length > 0
      ? user.email.trim()
      : null;
  const bodyEmail =
    typeof body.email === "string" && body.email.trim().length > 0
      ? body.email.trim()
      : null;
  if (bodyEmail && sessionEmail && bodyEmail.toLowerCase() !== sessionEmail.toLowerCase()) {
    return NextResponse.json({ error: "Email mismatch" }, { status: 400 });
  }

  const email = sessionEmail;
  if (!email) {
    return NextResponse.json(
      { error: "No email on account" },
      { status: 400 }
    );
  }

  const { data: item, error: itemErr } = await supabase
    .from("items")
    .select("id, user_id")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .single();

  if (itemErr || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const remindAt = addDays(new Date(), 30);

  const { error: insertErr } = await supabase.from("sentimental_nudges").insert({
    user_id: user.id,
    item_id: itemId,
    item_name: itemName,
    remind_at: remindAt.toISOString(),
    email,
    sent: false,
  });

  if (insertErr) {
    console.error("[POST /api/nudge/remind] insert:", insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const checkInPhrase = formatCheckInDate(remindAt);
  const apiKey = process.env.RESEND_API_KEY;
  let emailSent = true;
  if (!apiKey) {
    console.warn("[POST /api/nudge/remind] RESEND_API_KEY missing; row saved, no email");
    emailSent = false;
  } else {
    try {
      const resend = new Resend(apiKey);
      const { error: sendErr } = await resend.emails.send({
        from: "GoShed <support@goshed.app>",
        to: email,
        subject: "We’ll check in about your keep pile",
        html: `<p style="font-family:Georgia,serif;font-size:16px;color:#2C2416;line-height:1.5">Hi,</p>
<p style="font-family:Georgia,serif;font-size:16px;color:#2C2416;line-height:1.5">You asked us to remind you about <strong>${escapeHtml(itemName)}</strong> in about a month.</p>
<p style="font-family:Georgia,serif;font-size:16px;color:#2C2416;line-height:1.5">We’ll check in around <strong>${escapeHtml(checkInPhrase)}</strong>.</p>
<p style="font-family:Georgia,serif;font-size:16px;color:#5E7155;line-height:1.5">— GoShed</p>`,
      });
      if (sendErr) {
        console.error("[POST /api/nudge/remind] Resend:", sendErr);
        emailSent = false;
      }
    } catch (e) {
      console.error("[POST /api/nudge/remind] Resend exception:", e);
      emailSent = false;
    }
  }

  return NextResponse.json({ ok: true, emailSent, remindAt: remindAt.toISOString() });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
