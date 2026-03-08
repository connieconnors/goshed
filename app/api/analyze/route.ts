import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

type AnalyzeResult = {
  item_label: string;
  value_range: string;
  shippable: boolean;
  description: string;
};

function parseImagePayload(imagePayload: string): { data: string; mediaType: string } {
  if (imagePayload.startsWith("data:")) {
    const match = imagePayload.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
    if (match) {
      return { data: match[2], mediaType: match[1] };
    }
  }
  return { data: imagePayload, mediaType: "image/jpeg" };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: { image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const imagePayload = body.image;
  if (!imagePayload || typeof imagePayload !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'image' field (base64 or data URL)" },
      { status: 400 }
    );
  }

  const { data: base64Data, mediaType } = parseImagePayload(imagePayload);

  const systemPrompt = `You are an expert at identifying household and personal items for the GoShed app. Analyze the image and respond with a valid JSON object only (no markdown, no extra text) with exactly these keys:
- item_label: a short label for the item (e.g. "Vintage ceramic vase", "Hardcover novel")
- value_range: an estimated resale/value range in USD, e.g. "$5–15" or "$0 (sentimental only)"
- shippable: true if the item is reasonably shippable (size/weight), false if fragile, oversized, or not practical to ship
- description: one or two sentences describing the item and its condition`;

  const userMessage = `Analyze this image and return the JSON object as specified.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-url-access": "false",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: base64Data,
              },
            },
            { type: "text", text: userMessage },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json(
      { error: "Anthropic API error", details: errText },
      { status: response.status >= 500 ? 502 : 400 }
    );
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const textBlock = data.content?.find((b) => b.type === "text");
  const rawText = textBlock?.text?.trim() ?? "";

  let result: AnalyzeResult;
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("item_label" in parsed) ||
      !("value_range" in parsed) ||
      !("shippable" in parsed) ||
      !("description" in parsed)
    ) {
      throw new Error("Missing required fields");
    }
    result = {
      item_label: String(parsed.item_label),
      value_range: String(parsed.value_range),
      shippable: Boolean(parsed.shippable),
      description: String(parsed.description),
    };
  } catch {
    return NextResponse.json(
      { error: "Model did not return valid JSON", raw: rawText.slice(0, 500) },
      { status: 502 }
    );
  }

  return NextResponse.json(result);
}
