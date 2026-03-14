import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { grantProEntitlement } from "@/lib/revenuecat";

const VALID_PROMO_CODE = "BETAFRIEND";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const code = String(body.code ?? "").trim().toUpperCase();
  if (code !== VALID_PROMO_CODE) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const ok = await grantProEntitlement(user.id, "yearly");
  if (!ok) {
    return NextResponse.json({ error: "Failed to grant access" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
