import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

type AnalyzeResult = {
  item_label: string;
  value_range: string;
  shippable: boolean;
  description: string;
  best_next_life: "Sell" | "Donate" | "Gift" | "Repurpose" | "Curb" | "Keep";
  best_next_life_reason: string;
};

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

/** HEIC/HEIF (iPhone) magic: bytes 4–7 "ftyp", bytes 8–11 brand (mif1, heic, heix, msf1). */
function isHeicBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const ftyp = buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70;
  if (!ftyp) return false;
  const brand = buf.slice(8, 12).toString("ascii");
  return ["mif1", "heic", "heix", "msf1"].includes(brand);
}

/** Detect actual image format from base64 magic bytes so Anthropic gets the correct media_type. */
function detectMediaTypeFromBase64(base64: string): (typeof ALLOWED_MEDIA_TYPES)[number] {
  try {
    const buf = Buffer.from(base64, "base64");
    if (buf.length < 12) return "image/jpeg";
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && (buf[3] === 0x38 || buf[3] === 0x39)) return "image/gif";
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x52 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
    if (isHeicBuffer(buf)) return "image/jpeg"; // we convert HEIC to JPEG before sending
  } catch {
    /* ignore */
  }
  return "image/jpeg";
}

function parseImagePayload(imagePayload: string): { data: string; mediaType: (typeof ALLOWED_MEDIA_TYPES)[number] } | null {
  const trimmed = imagePayload.trim();
  if (trimmed.startsWith("data:")) {
    const base64Prefix = ";base64,";
    const idx = trimmed.indexOf(base64Prefix);
    if (idx === -1) return null;
    const mediaPart = trimmed.slice(5, idx).trim().toLowerCase();
    const rawBase64 = trimmed.slice(idx + base64Prefix.length).replace(/\s/g, "");
    if (!rawBase64) return null;
    const typeOnly = mediaPart.startsWith("image/") ? mediaPart.split(";")[0]!.trim() : "image/jpeg";
    const allowed: (typeof ALLOWED_MEDIA_TYPES)[number] = ALLOWED_MEDIA_TYPES.includes(typeOnly as (typeof ALLOWED_MEDIA_TYPES)[number])
      ? (typeOnly as (typeof ALLOWED_MEDIA_TYPES)[number])
      : "image/jpeg";
    return { data: rawBase64, mediaType: allowed };
  }
  const noWhitespace = trimmed.replace(/\s/g, "");
  if (!noWhitespace) return null;
  return { data: noWhitespace, mediaType: "image/jpeg" };
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
      { error: "Missing or invalid image. Please try another photo." },
      { status: 400 }
    );
  }

  const parsed = parseImagePayload(imagePayload);
  if (!parsed || !parsed.data) {
    return NextResponse.json(
      { error: "We couldn't use that image. Please try a different photo." },
      { status: 400 }
    );
  }

  let rawBase64 = parsed.data;
  // Normalize URL-safe base64 to standard so Buffer.from can decode
  rawBase64 = rawBase64.replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/=]+$/.test(rawBase64)) {
    return NextResponse.json(
      { error: "Invalid image format. Please try another photo." },
      { status: 400 }
    );
  }

  // HEIC (iPhone) is not supported by Anthropic — convert to JPEG first
  let buf = Buffer.from(rawBase64, "base64");
  if (isHeicBuffer(buf)) {
    try {
      const convert = (await import("heic-convert")).default;
      const jpegBuffer = await convert({ buffer: buf, format: "JPEG", quality: 0.9 });
      const out =
        Buffer.isBuffer(jpegBuffer) ? jpegBuffer : jpegBuffer instanceof Uint8Array ? Buffer.from(jpegBuffer) : Buffer.from(new Uint8Array(jpegBuffer as ArrayBuffer));
      rawBase64 = out.toString("base64");
      buf = Buffer.from(rawBase64, "base64");
    } catch (heicErr) {
      console.error("[analyze] HEIC conversion failed:", heicErr);
      return NextResponse.json(
        { error: "We couldn't process that photo format. Try saving as JPEG or PNG first." },
        { status: 400 }
      );
    }
  }

  // Use actual image format from bytes so Anthropic doesn't return "Could not process image"
  const mediaType = detectMediaTypeFromBase64(rawBase64);

  // Anthropic has request size limits; very large images often fail
  const decodedLength = buf.length;
  if (decodedLength > 4_500_000) {
    return NextResponse.json(
      { error: "Image is too large. Try a smaller or compressed photo." },
      { status: 400 }
    );
  }

  const systemPrompt = `You are an expert at identifying household and personal items for the GoShed app. Analyze the image and respond with a valid JSON object only (no markdown, no extra text) with exactly these keys:
- item_label: a short label for the main item(s) clearly visible (e.g. "Vintage ceramic vase", "Hardcover novel"). Do not try to name or interpret partly obscured items in a stack — label what's in focus; the user can add another photo for other pieces.
- value_range: estimated resale value in USD, e.g. "$5–15" or "$0 (no resale value)"
- shippable: false for ANY of these: lamps, lighting fixtures, furniture, mirrors, large framed art, rugs, bedding, mattresses, appliances, large ceramics, glassware, sculptures, oversized or fragile items. true only for items that are small, sturdy, and under approximately 5 lbs — like books, clothing, small collectibles, jewelry, electronics, small tools. When in doubt, return false.
- description: 1–2 sentences. Identify brand/manufacturer if visible; if uncertain, note comparable brands or styles. Describe only what is clearly visible. Do not infer or speculate about partially obscured items or what is "behind" something in a stack — if something is partly visible, say so briefly without guessing; it is up to the user to add a better photo or note if they want to highlight specific pieces.
- best_next_life: one of exactly these values: "Sell", "Donate", "Gift", "Repurpose", "Curb", "Keep"
- best_next_life_reason: 1–2 sentences explaining the recommendation in a warm, practical tone.

DECISION RULES for best_next_life — evaluate in this order:

CURB (do not donate, no value to anyone):
- Visibly stained, moldy, cracked, broken, or heavily worn
- Missing parts that make it non-functional
- Hygiene items that cannot be donated (used pillows, mattresses, undergarments)
- So low quality or damaged that a thrift store would reject it
- Estimated value under $2 with no sentimental or craft potential

REPURPOSE (broken but material has value):
- Damaged but fabric, wood, metal, or ceramic could be reused creatively
- Craft or upcycle potential is obvious from the image

SELL (worth the effort to list):
- Collectible, vintage, branded, or niche interest item
- Estimated value $15 or more
- Good condition — no visible damage, staining, or heavy wear
- Has a clear secondary market (eBay, ThriftShopper, Etsy, Facebook Marketplace)

DONATE (functional, clean, but not worth selling):
- Good condition but estimated value under $15
- Practical everyday item a thrift store would accept and sell
- No obvious damage or wear

GIFT (has personal or aesthetic appeal for a specific recipient):
- Good condition
- Has charm, personality, or style that would delight someone specific
- Better as a thoughtful gift than a $3 thrift store item

KEEP (only if clearly personal/sentimental or actively useful):
- Has strong sentimental signals (photos, personalization, handmade)
- Or is a high-quality everyday item the owner likely still uses

Default to SELL or DONATE when uncertain. Never recommend CURB unless damage or wear is clearly visible in the image.`;

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
                media_type: mediaType,
                data: rawBase64,
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
    console.error("[analyze] Anthropic API error:", response.status, errText.slice(0, 500));
    return NextResponse.json(
      { error: "We couldn't analyze this image. Try another photo." },
      { status: response.status >= 500 ? 502 : 400 }
    );
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const textBlock = data.content?.find((b) => b.type === "text");
  const rawText = textBlock?.text?.trim() ?? "";

  const ALLOWED_BEST_NEXT_LIFE = ["Sell", "Donate", "Gift", "Repurpose", "Curb", "Keep"] as const;
  let result: AnalyzeResult;
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("item_label" in parsed) ||
      !("value_range" in parsed) ||
      !("shippable" in parsed) ||
      !("description" in parsed) ||
      !("best_next_life" in parsed) ||
      !("best_next_life_reason" in parsed)
    ) {
      throw new Error("Missing required fields");
    }
    const bnl = String((parsed as Record<string, unknown>).best_next_life);
    if (!ALLOWED_BEST_NEXT_LIFE.includes(bnl as (typeof ALLOWED_BEST_NEXT_LIFE)[number])) {
      throw new Error("Invalid best_next_life");
    }
    result = {
      item_label: String(parsed.item_label),
      value_range: String(parsed.value_range),
      shippable: Boolean(parsed.shippable),
      description: String(parsed.description),
      best_next_life: bnl as AnalyzeResult["best_next_life"],
      best_next_life_reason: String((parsed as Record<string, unknown>).best_next_life_reason),
    };
  } catch {
    return NextResponse.json(
      { error: "Model did not return valid JSON", raw: rawText.slice(0, 500) },
      { status: 502 }
    );
  }

  return NextResponse.json(result);
}
