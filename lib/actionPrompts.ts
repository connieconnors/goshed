/**
 * Post-confirmation action prompts by recommendation type.
 * Three variations per type; one is chosen at random when the user confirms.
 * Edit or add variations here to change copy without touching the UI.
 */

export type ActionPromptType =
  | "gift"
  | "donate"
  | "sell"
  | "keep"
  | "trash"
  | "curb"
  | "repurpose";

export const ACTION_PROMPTS: Record<ActionPromptType, readonly [string, string, string]> = {
  gift: [
    "Box it or bag it. Better yet, put some brownies on that plate and show up at someone's door. That's a gift they'll remember.",
    "Wrap it, then get it to them this week. The best gifts are the ones that show up without a holiday attached — just because you thought of them.",
    "Tuck it into a tote. Hand it over in person if you can. A quick \"I thought of you\" beats a box in the mail. Add a note or a treat and call it done.",
  ],
  donate: [
    "Box it or bag it tonight. Leave it by the door so it actually leaves the house. Most donation centers are open tomorrow morning.",
    "Set it aside tonight by the door. Tomorrow morning drop it off — one less thing in the house and someone else gets to use it.",
    "Drop it off on your next errand run, or schedule a pickup. Out of sight, out of the house.",
  ],
  sell: [
    "Snap three photos in good light right now. Price it a little lower than you think and it'll be gone by the weekend.",
    "Photos first, then list it. Good light, clean background. Price to move and it'll sell; sit on the number and it'll sit on the shelf.",
    "List it today with clear photos and a fair price. The sooner it's up, the sooner it's sold. You've already decided — now just post it.",
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

/** Pick one of the three prompts at random for a given type. */
export function getRandomActionPrompt(
  type: ActionPromptType
): string {
  const prompts = ACTION_PROMPTS[type];
  const index = Math.floor(Math.random() * prompts.length);
  return prompts[index];
}
