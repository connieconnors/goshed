import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

type RecommendResult = {
  recommendation: "gift" | "donate" | "sell" | "keep" | "trash" | "curb" | "repurpose";
  reason: string;
  next_step: string;
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  let body: { item_label?: string; value_range?: string; shippable?: boolean; user_note?: string; user_override?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { item_label, value_range, shippable, user_note, user_override } = body;
  if (!item_label || value_range === undefined || shippable === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const validRecommendations = ["gift", "donate", "sell", "keep", "curb", "repurpose"] as const;
  const override = typeof user_override === "string" ? user_override.trim().toLowerCase() : undefined;
  if (override && !validRecommendations.includes(override as (typeof validRecommendations)[number])) {
    return NextResponse.json({ error: "Invalid user_override" }, { status: 400 });
  }

  const noteText = typeof user_note === "string" ? user_note.trim() : "";
  if (noteText) console.log("[recommend] user_note:", noteText.slice(0, 200));
  if (override) console.log("[recommend] user_override:", override);

  const systemPrompt = `You are GoShed: a calm, decisive engine for what to do with things people own. Return exactly one recommendation — no hedging.

DECISION RULES — evaluate in this order:

CURB (leave outside free): Item is bulky or low-value AND any of these: visibly worn, stained, faded, scratched, or damaged but still functional. Also use CURB for truly unusable items (broken beyond use, missing critical parts, moldy, hygiene items like used pillows or undergarments). Not worth a thrift store's time; someone driving by might want it or it can be left for disposal. Furniture, lamps, sporting goods, and housewares in rough shape belong here.

REPURPOSE: Damaged but material has obvious second life — fabric for craft, wood for DIY, ceramic for mosaic. Only if repurpose potential is clear.

SELL: Collectible, vintage, branded, or niche interest item in good condition. Estimated value $15+. Has a real secondary market.

DONATE: Functional, clean, good condition, estimated value under $15. A thrift store would accept and sell it. Practical everyday item.

GIFT: Good condition with charm, personality, or style that fits someone in the person's life or an upcoming event. Better as a thoughtful gift than a $3 thrift item.

KEEP: Strong sentimental signals, personalized, handmade, or a high-quality item clearly still in active use.

Default to SELL or DONATE when uncertain. Never recommend CURB unless wear, damage, or bulk makes donation impractical.

next_step: one sentence. Must match the recommendation exactly:
- SELL: suggest the best platform (eBay, Poshmark, Chairish, Facebook Marketplace, ThriftShopper) based on item type
- DONATE: suggest dropping it off or scheduling pickup — no selling platforms
- GIFT: suggest who or when to give it
- CURB: suggest putting it out or scheduling a dump run
- REPURPOSE: suggest one specific craft or reuse idea
- KEEP: suggest where to store or display it

Output: valid JSON only — recommendation (one of: gift | donate | sell | curb | repurpose | keep), reason (one warm practical sentence), next_step (one sentence matching the rule above).`;

  const userMessage = `Item: ${item_label}
Value: ${value_range}
Shippable: ${shippable}${noteText ? `

Additional context from the user (use this to refine your recommendation): ${noteText}` : ""}

Consider whether this item would make a thoughtful gift for someone — a recent grad, someone moving, a friend who would appreciate it.

${override ? `The user has chosen "${override}". Return JSON with recommendation set to "${override}", and provide a reason and next_step that match this choice (follow the next_step rules for that recommendation).` : "Using the decision guidance, choose the single best next life for this item."} Respond with only valid JSON: recommendation, reason, next_step.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  // Temporary debug: log response status and body when not ok
  if (!response.ok) {
    const errText = await response.text();
    console.error("[recommend] Anthropic response not ok:", response.status, errText.slice(0, 500));
    return NextResponse.json({ error: "Anthropic API error", details: errText }, { status: response.status >= 500 ? 502 : 400 });
  }

  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const textBlock = data.content?.find((b) => b.type === "text");
  const rawText = textBlock?.text?.trim() ?? "";

  // Temporary debug: raw text before JSON parsing
  console.log("[recommend] response.status:", response.status, "rawText length:", rawText.length, "rawText preview:", rawText.slice(0, 300));
  if (!rawText) {
    console.error("[recommend] empty rawText - full data structure:", JSON.stringify(data).slice(0, 800));
  }

  let result: RecommendResult;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in model response");
    }
    const jsonStr = jsonMatch[0].replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(jsonStr) as unknown;
    if (typeof parsed !== "object" || parsed === null || !("recommendation" in parsed) || !("reason" in parsed) || !("next_step" in parsed)) {
      throw new Error("Missing required fields");
    }
    const rec = String((parsed as Record<string, unknown>).recommendation).toLowerCase();
    if (!validRecommendations.includes(rec as (typeof validRecommendations)[number])) {
      throw new Error("Invalid recommendation value");
    }
    result = {
      recommendation: rec as RecommendResult["recommendation"],
      reason: String((parsed as Record<string, unknown>).reason),
      next_step: String((parsed as Record<string, unknown>).next_step),
    };
  } catch (parseErr) {
    console.error("[recommend] JSON parse failed:", parseErr, "rawText preview:", rawText.slice(0, 500));
    return NextResponse.json({ error: "Model did not return valid JSON", raw: rawText.slice(0, 500) }, { status: 502 });
  }

  return NextResponse.json(result);
}
