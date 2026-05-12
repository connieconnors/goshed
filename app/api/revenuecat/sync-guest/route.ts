import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  aliasRevenueCatSubscriber,
  grantProEntitlement,
  hasProEntitlement,
} from "@/lib/revenuecat";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { guestAppUserId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const guestAppUserId = typeof body.guestAppUserId === "string" ? body.guestAppUserId.trim() : "";
  if (!guestAppUserId.startsWith("guest:")) {
    return NextResponse.json({ error: "Invalid guest purchaser" }, { status: 400 });
  }

  if (await hasProEntitlement(user.id)) {
    return NextResponse.json({ success: true, alreadyActive: true });
  }

  const guestIsPro = await hasProEntitlement(guestAppUserId);
  if (!guestIsPro) {
    return NextResponse.json({ error: "No active guest subscription found" }, { status: 404 });
  }

  const aliased = await aliasRevenueCatSubscriber(guestAppUserId, user.id);
  if (aliased && await hasProEntitlement(user.id)) {
    return NextResponse.json({ success: true, aliased: true });
  }

  // Fallback keeps paying guests unblocked if RevenueCat alias propagation is delayed.
  const granted = await grantProEntitlement(user.id, "yearly");
  if (!granted) {
    return NextResponse.json({ error: "Could not sync subscription" }, { status: 502 });
  }

  return NextResponse.json({ success: true, aliased, promotionalFallback: true });
}
