import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("items")
    .select("id, photo_url, item_label, recommendation, value_range_raw, value_low, value_high, status, notes, created_at, cleared_at, bucket_change_count")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: { status?: string; recommendation?: string; cleared_at?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validRec = ["sell", "donate", "gift", "curb", "keep", "repurpose"];

  const { data: existing, error: fetchErr } = await supabase
    .from("items")
    .select("recommendation, bucket_change_count")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: {
    status?: string;
    recommendation?: string;
    cleared_at?: string | null;
    bucket_change_count?: number;
  } = {};
  if (body.status === "done") {
    updates.status = "done";
    updates.cleared_at = null;
  } else if (body.status === "pending") {
    updates.status = "pending";
    updates.cleared_at = null;
  } else if (body.status === "cleared") {
    updates.status = "cleared";
    const raw = body.cleared_at;
    const fromClient =
      typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
    updates.cleared_at = fromClient ?? new Date().toISOString();
  }
  if (body.recommendation != null && validRec.includes(body.recommendation)) {
    updates.recommendation = body.recommendation;
    if (body.recommendation !== existing.recommendation) {
      const prev = existing.bucket_change_count;
      const n = typeof prev === "number" && Number.isFinite(prev) ? prev : 0;
      updates.bucket_change_count = n + 1;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Provide status and/or recommendation" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("items")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, photo_url, item_label, recommendation, value_range_raw, value_low, value_high, status, notes, created_at, cleared_at, bucket_change_count")
    .single();

  if (error) {
    console.error("[PATCH /api/items/[id]] supabase update error:", error.message, { id, updatesKeys: Object.keys(updates) });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("items")
      .update({ hidden: true })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE] unexpected error:", err);
    return NextResponse.json({ error: "Server error", details: String(err) }, { status: 500 });
  }
}
