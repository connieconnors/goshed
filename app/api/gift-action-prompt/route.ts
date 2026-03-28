import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  let body: { item_label?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const item_label = typeof body.item_label === "string" ? body.item_label.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!item_label || !reason) {
    return NextResponse.json({ error: "Missing item_label or reason" }, { status: 400 });
  }

  const systemPrompt = `You write short post-confirmation copy for someone who just chose to GIFT an item.

Output valid JSON only, with a single key "beats" whose value is an array of exactly 2 strings. No other keys.

Rules for each string:
- Exactly one sentence each. No labels, headers, bullets, or prefixes like "Tip:" or "Who:" — only the sentence itself.
- Beat 1 — What to do with it: one practical packaging or presentation sentence that fits THIS specific item (use item_label and reason to choose). Vary the approach — do not reuse the same packaging idea every time. BANNED: the phrase "nestle in a gift bag" and close variants (do not default to gift-bag language). Match type when applicable: small or delicate → wrap it in tissue and tuck it in a box; food-related or a vessel (bowl, jar, basket, tin) → suggest filling it before you give it — e.g. chocolates, a candle, or a small plant; clothing → fold it and tie a ribbon around it; art, framed piece, or large/awkward → lean it against their door with a note; gadget or electronics → box it up so opening it feels like part of the gift. The line must sound tailored to this item, not generic gifting advice anyone could use for anything.
- Beat 2 — Who it's for: one sentence suggesting the right kind of recipient, specific to this item (use item_label and reason). Examples (adapt): kitchenware or entertaining → hostess, neighbor, or anyone who loves to cook; gadget → the person on your list who has everything; art or decorative → someone who just moved or redecorated.

Tone: warm, specific, never generic boilerplate. The two sentences should read as one short note when read in order.`;

  const userMessage = `item_label: ${item_label}

reason: ${reason}

Return only JSON: {"beats":["packaging/presentation sentence","recipient sentence"]}`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 320,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[gift-action-prompt] Anthropic error:", response.status, errText.slice(0, 400));
    return NextResponse.json({ error: "Anthropic API error", details: errText }, { status: response.status >= 500 ? 502 : 400 });
  }

  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const textBlock = data.content?.find((b) => b.type === "text");
  const rawText = textBlock?.text?.trim() ?? "";
  if (!rawText) {
    return NextResponse.json({ error: "Empty model response" }, { status: 502 });
  }

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found");
    const jsonStr = jsonMatch[0].replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(jsonStr) as unknown;
    if (typeof parsed !== "object" || parsed === null || !("beats" in parsed)) {
      throw new Error("Missing beats");
    }
    const beats = (parsed as { beats: unknown }).beats;
    if (!Array.isArray(beats) || beats.length !== 2) {
      throw new Error("beats must be array of 2 strings");
    }
    const out = beats.map((b) => String(b).trim()).filter(Boolean);
    if (out.length !== 2) {
      throw new Error("empty beat");
    }
    return NextResponse.json({ beats: out as [string, string] });
  } catch (e) {
    console.error("[gift-action-prompt] parse error:", e, rawText.slice(0, 300));
    return NextResponse.json({ error: "Invalid model output" }, { status: 502 });
  }
}
