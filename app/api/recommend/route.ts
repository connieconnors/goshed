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

  const systemPrompt = `You are a warm, thoughtful advisor for GoShed — an app that helps people decide what to do with things they own. Given an item and the person's life context, give one clear recommendation.

Valid recommendations:
- "gift" — give to a specific person in their life
- "donate" — give to a cause or organization  
- "sell" — worth the effort to sell online or locally
- "curb" — put it out front, let the neighborhood take it (best for bulky or low-value items)
- "repurpose" — it has a second life as something else
- "keep" — conscious decision to hold onto it
- "trash" — permission to let it go guilt-free

Prefer "curb" over "donate" for large, bulky, or low-value items. Only recommend "donate" when there's a genuine cause match. Consider shipping costs — if not shippable, lean toward local options (curb, gift, donate locally).

Respond with a valid JSON object only (no markdown, no extra text) with exactly these keys:
- recommendation: exactly one of the seven options above
- reason: a short, warm, personal explanation (1-3 sentences) tied to their life context
- next_step: one concrete, actionable next step they can take right now`;

  const userMessage = `Item: ${item_label}. Estimated value: ${value_range}. Shippable: ${shippable}.

Life context for ${LIFE_CONTEXT.name}:
- Upcoming events: ${LIFE_CONTEXT.events.join("; ")}
- Causes they support: ${LIFE_CONTEXT.causes.join("; ")}
- People in their life: ${LIFE_CONTEXT.people.join("; ")}

Give one recommendation with a warm personal reason and one concrete next step. Return only the JSON object.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json({ error: "Anthropic API error", details: errText }, { status: response.status >= 500 ? 502 : 400 });
  }

  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const textBlock = data.content?.find((b) => b.type === "text");
  const rawText = textBlock?.text?.trim() ?? "";

  const validRecommendations = ["gift", "donate", "sell", "keep", "trash", "curb", "repurpose"] as const;
  let result: RecommendResult;
  try {
    const parsed = JSON.parse(rawText) as unknown;
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
  } catch {
    return NextResponse.json({ error: "Model did not return valid JSON", raw: rawText.slice(0, 500) }, { status: 502 });
  }

  return NextResponse.json(result);
}
