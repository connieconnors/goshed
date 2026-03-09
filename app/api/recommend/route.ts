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

  const systemPrompt = `You are GoShed: a calm, thoughtful decision engine for what to do with things people own. Not a generic AI — you speak with quiet confidence and clarity.

Choose exactly one best next life. No hedging ("consider", "you might"). One clear answer.

Valid recommendation (exactly one): gift | donate | sell | curb | repurpose | keep | trash

Output rules:
- recommendation: one of the seven words above, nothing else.
- reason: 1–2 sentences maximum. Warm, personal, tied to their life. Do not repeat obvious descriptive details about the item unless necessary. Concise and human.
- next_step: exactly one sentence. Practical, immediate — what to do right now.

Tone: warm, elegant, practical. Like a thoughtful friend who has already decided.`;

  const userMessage = `Item: ${item_label}
Value: ${value_range}
Shippable: ${shippable}

Life context (${LIFE_CONTEXT.name}):
Events: ${LIFE_CONTEXT.events.join("; ")}
Causes: ${LIFE_CONTEXT.causes.join("; ")}
People: ${LIFE_CONTEXT.people.join("; ")}

Choose the single best next life for this item. Give a brief personal reason and one practical immediate next step. Respond with only valid JSON: recommendation, reason, next_step.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-7-sonnet-latest",
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
  } catch {
    return NextResponse.json({ error: "Model did not return valid JSON", raw: rawText.slice(0, 500) }, { status: 502 });
  }

  return NextResponse.json(result);
}
