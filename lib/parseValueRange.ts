/**
 * Parse value_range_raw (e.g. "$15–40" or "$10-20") into value_low and value_high.
 * Strips $ and splits on – (en dash) or - (hyphen).
 */
export function parseValueRange(raw: string): { value_low: number; value_high: number } {
  const cleaned = raw.replace(/\$/g, "").trim();
  const parts = cleaned.split(/[–-]/).map((s) => s.trim());
  const parseNum = (s: string) => {
    const n = parseInt(s.replace(/[^0-9]/g, ""), 10);
    return isNaN(n) ? 0 : n;
  };
  if (parts.length >= 2) {
    return { value_low: parseNum(parts[0]), value_high: parseNum(parts[1]) };
  }
  const single = parseNum(parts[0] ?? "");
  return { value_low: single, value_high: single };
}
