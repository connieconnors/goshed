import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { parseValueRange } from "@/lib/parseValueRange";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("items")
    .select("id, photo_url, item_label, recommendation, value_range_raw, value_low, value_high, status, created_at, cleared_at")
    .eq("user_id", user.id)
    .eq("hidden", false)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[api/items] list error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    photo_url?: string;
    item_label: string;
    value_range_raw: string;
    recommendation: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { item_label, value_range_raw, recommendation, notes } = body;
  const photo_url = body.photo_url ?? null;
  if (!item_label || !value_range_raw || !recommendation) {
    return NextResponse.json(
      { error: "Missing item_label, value_range_raw, or recommendation" },
      { status: 400 }
    );
  }

  const validRec = ["sell", "donate", "gift", "curb", "keep", "repurpose"];
  if (!validRec.includes(recommendation)) {
    return NextResponse.json({ error: "Invalid recommendation" }, { status: 400 });
  }

  const { value_low, value_high } = parseValueRange(value_range_raw);

  const { data, error } = await supabase
    .from("items")
    .insert({
      user_id: user.id,
      photo_url,
      item_label,
      recommendation,
      value_range_raw,
      value_low,
      value_high,
      status: "pending",
      notes: notes ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[api/items] insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
