import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

type AnalyzeResult = {
  item_label: string;
  value_range: string;
  shippable: boolean;
  description: string;
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

  const systemPrompt = `You are an expert at identifying household and personal items for the GoShed app (ThriftShopper-style). Analyze the image and respond with a valid JSON object only (no markdown, no extra text) with exactly these keys:
- item_label: a short label for the item (e.g. "Vintage ceramic vase", "Hardcover novel")
- value_range: an estimated resale/value range in USD, e.g. "$5–15" or "$0 (sentimental only)"
- shippable: true if the item is reasonably shippable (size/weight), false if fragile, oversized, or not practical to ship
- description: a brief description that supports trust and resale intelligence. When describing the item: (1) Identify possible brand, manufacturer, or known product line if visible. (2) If uncertain, mention likely comparable brands or styles. (3) If the item resembles a known brand (e.g. ForLife, Corelle, Pyrex), state that clearly. (4) Avoid generic descriptions when brand cues exist. Keep it to one or two sentences. Example: "Ceramic teapot with stainless lid, similar to designs from ForLife."`;

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
