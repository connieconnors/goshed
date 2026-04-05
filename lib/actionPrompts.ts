/**
 * Post-confirmation action prompts by recommendation type.
 * Three variations per type; one is chosen at random when the user confirms.
 * Edit or add variations here to change copy without touching the UI.
 */

import { parseValueRange } from "./parseValueRange";
import { BULK_PICKUP_DONATION_COPY, isBulkyPickupDonationContext } from "./contextualSuggestions";

export type ActionPromptType =
  | "gift"
  | "donate"
  | "sell"
  | "keep"
  | "trash"
  | "curb"
  | "repurpose";

/** Plate-specific gift prompt (only used when item is plate-like). */
const GIFT_PROMPT_PLATE =
  "Box it or bag it. Better yet, put some brownies on that plate and show up at someone's door. That's a gift they'll remember.";

/** Generic gift prompts (used when item is not plate-like, or when no context is passed). */
const GIFT_PROMPTS_GENERIC: readonly [string, string, string] = [
  "Box it or bag it, then get it to them this week. The best gifts are the ones that show up without a holiday attached — just because you thought of them.",
  "Wrap it and hand it over in person if you can. A quick \"I thought of you\" beats a box in the mail. Add a note and call it done.",
  "Tuck it into a tote or wrap it simply. The thought counts — get it to them soon so they know you were thinking of them.",
];

export const ACTION_PROMPTS: Record<ActionPromptType, readonly [string, string, string]> = {
  gift: GIFT_PROMPTS_GENERIC,
  donate: [
    "Box it or bag it tonight. Leave it by the door so it actually leaves the house.",
    "Set it aside tonight by the door. Call ahead to confirm hours, then drop it off — one less thing in the house.",
    "Call ahead to confirm what they accept and their hours — then get it out the door this week. Out of sight, out of the house.",
  ],
  sell: [
    "List it on local selling apps or in neighborhood buy/sell groups — good photos, clean background, price to move. Nearby buyers for this kind of thing are usually quick.",
    "Post in a neighborhood buy/sell group or on local selling apps. Snap a few shots in good light and set a fair price; sit on the number and it'll sit on the shelf.",
    "Get it onto secondhand marketplaces or resale apps today. Clear photos and a fair price; you've already decided — now just post it.",
  ],
  keep: [
    "Now you know it's a keeper. Give it a spot that does it justice — not a junk drawer.",
    "Now you know it's a keeper. Give it a spot that does it justice — not a junk drawer.",
    "Now you know it's a keeper. Give it a spot that does it justice — not a junk drawer.",
  ],
  curb: [
    "Write FREE on a piece of paper, set it out Saturday morning. Gone by noon. It happens every time.",
    "Put it on the curb with a FREE sign. Weekend morning is best. Someone will take it — they always do.",
    "FREE sign, curb, Saturday. Don't overthink it. It'll be gone before you finish your coffee.",
  ],
  repurpose: [
    "Don't let this one sit. Give yourself 48 hours or it becomes clutter again. What's the first step you can do right now?",
    "Pick one small step and do it today. Cut, paint, or move it to where it'll get used. Two days of inaction and it's back to clutter.",
    "One concrete step in the next 48 hours — or admit it's not happening and gift, donate, or curb it. Your call.",
  ],
  trash: [
    "Not everything deserves a second life. Walk it to the bin now so it doesn't creep back in.",
    "Toss it today. If you've decided it's trash, don't let it sit — out it goes and you're done.",
    "Into the bin and out of the house. No guilt. Some things have served their purpose.",
  ],
};

/** True if the item sounds like a plate (plate, platter, serving dish, etc.). */
function isPlateLike(item_label: string, description: string): boolean {
  const text = `${item_label} ${description}`.toLowerCase();
  return /\b(plate|platter|serving (dish|tray|bowl)|dish|charger)\b/.test(text);
}

const CONSIGNMENT_SENTENCE =
  "At this price point, a local consignment shop might do the work for you — they'll photograph, list, and handle the sale.";

/** Pick one of the three prompts at random for a given type. For "gift", uses item context so plate-specific copy only appears for plate-like items. For "sell", appends consignment copy when value_range high end is $100+. */
export function getRandomActionPrompt(
  type: ActionPromptType,
  context?: { item_label?: string; description?: string; value_range?: string }
): string {
  if (type === "gift" && context) {
    const label = context.item_label ?? "";
    const desc = context.description ?? "";
    if (isPlateLike(label, desc)) {
      return GIFT_PROMPT_PLATE;
    }
    const index = Math.floor(Math.random() * GIFT_PROMPTS_GENERIC.length);
    return GIFT_PROMPTS_GENERIC[index];
  }
  if (type === "donate" && context) {
    if (isBulkyPickupDonationContext(context.item_label, context.description)) {
      return BULK_PICKUP_DONATION_COPY;
    }
  }
  if (type === "sell") {
    const prompts = ACTION_PROMPTS.sell;
    const index = Math.floor(Math.random() * prompts.length);
    let text = prompts[index];
    const raw = context?.value_range?.trim();
    if (raw) {
      const { value_high } = parseValueRange(raw);
      if (value_high >= 100) {
        text += `\n\n${CONSIGNMENT_SENTENCE}`;
      }
    }
    return text;
  }
  const prompts = ACTION_PROMPTS[type];
  const index = Math.floor(Math.random() * prompts.length);
  return prompts[index];
}
