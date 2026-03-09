import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const LIFE_CONTEXT = {
  name: "Connie",
  events: ["summer backyard party in July", "son Ryan moving to Brooklyn"],
  causes: ["North Shore Soup Kitchen silent auction next month"],
  people: ["Maya - niece graduating law school in May"],
};

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

  let body: { item_label?: string; value_range?: string; shippable?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { item_label, value_range, shippable } = body;
  if (!item_label || value_range === undefined || shippable === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Temporary debug: confirm request body before Anthropic fetch
  console.log("[recommend] request body:", { item_label, value_range, shippable });

  const systemPrompt = `You are GoShed: a calm, thoughtful decision engine for what to do with things people own. Determine the best next life for each item using the following logic. Return exactly one recommendation — no hedging.

Factors to consider:
1. Estimated resale value (from value_range)
2. Collectibility or brand recognition
3. Shipping practicality (shippable true/false)
4. Charity usefulness (who would benefit from a donation)
5. Emotional or gift potential (upcoming events, people in their life)

Decision guidance — use these rules to pick the best option:
- If resale value likely exceeds $25 → prioritize SELL
- If collectible or branded (known maker, vintage, sought-after) → prioritize SELL
- If bulky or low resale but usable → consider DONATE
- If personal or gift-like and fits someone in their life/events → consider GIFT
- If worn but usable in another way → consider REPURPOSE
- If broken, stained, or unusable → TRASH
- If large/furniture and not worth selling → consider CURB (free pickup) or DONATE
- If genuinely worth keeping (sentimental, daily use) → KEEP

Valid recommendation (exactly one): gift | donate | sell | curb | repurpose | keep | trash

Output rules:
- recommendation: one of the seven words above, nothing else.
- reason: one sentence. Warm, personal, tied to the decision. Do not repeat obvious item details. Concise.
- next_step: one sentence. Practical, immediate — what to do right now.

Tone: warm, elegant, practical. Like a thoughtful friend who has already decided. Do not default to donate — match the recommendation to the value, brand, and context.`;

  const userMessage = `Item: ${item_label}
Value: ${value_range}
Shippable: ${shippable}

Life context (${LIFE_CONTEXT.name}):
Events: ${LIFE_CONTEXT.events.join("; ")}
Causes: ${LIFE_CONTEXT.causes.join("; ")}
People: ${LIFE_CONTEXT.people.join("; ")}

Using the decision guidance, choose the single best next life for this item. Respond with only valid JSON: recommendation, reason, next_step.`;

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

  const validRecommendations = ["gift", "donate", "sell", "keep", "trash", "curb", "repurpose"] as const;
  let result: RecommendResult;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in model response");
    }
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
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
