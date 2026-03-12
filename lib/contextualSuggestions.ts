/**
 * Contextual donation suggestions (Google Places).
 */

/** Returns the best Google Places search query for donate/gift from item text. */
export function getPlacesSearchQuery(itemLabel: string, description?: string): string {
  const text = `${itemLabel ?? ""} ${description ?? ""}`.toLowerCase();

  if (
    /\b(linen|towels?|blanket|sheet|pet bed|pet\b|dog|cat)\b/.test(text) ||
    /bedding|pillow/.test(text)
  ) {
    return "animal shelter";
  }

  if (/\b(book|novel|textbook)\b/.test(text)) {
    return "library used bookstore";
  }

  if (
    /\b(frame|picture frame|art|painting|poster|print|decor|vase|ceramic|pottery|sculpture)\b/.test(text) ||
    /\b(lamp|mirror|rug|curtain)\b/.test(text) ||
    /\b(kitchen|dishes?|plate|cup|pot|pan|cookware|housewares?|glassware)\b/.test(text) ||
    /\b(furniture|sofa|couch|table|desk|bed|mattress|chair|dresser|cabinet)\b/.test(text) ||
    /\b(appliance|refrigerator|washer|dryer|stove)\b/.test(text)
  ) {
    return "donation thrift";
  }

  if (
    /\b(clothing|clothes|shirt|pants|dress|jacket|coat|shoes|boots|sneakers|scarf|hat|gloves|belt|purse|handbag)\b/.test(text) ||
    /\b(accessories|accessory)\b/.test(text)
  ) {
    return "Goodwill clothing donation";
  }

  if (
    /\b(electronics?|tv|television|computer|laptop|phone|monitor|printer)\b/.test(text)
  ) {
    return "Goodwill electronics recycling";
  }

  if (/\b(toy|toys|game|games|puzzle|stuffed)\b/.test(text)) {
    return "children's shelter toy donation";
  }

  return "donation thrift";
}

/** Whether the item sounds large/heavy (for curb + weather suggestion). */
export function isLargeItem(itemLabel: string, description?: string): boolean {
  const text = `${itemLabel ?? ""} ${description ?? ""}`.toLowerCase();
  return (
    /\b(furniture|sofa|couch|table|desk|bed|mattress|chair|dresser|cabinet)\b/.test(text) ||
    /\b(appliance|refrigerator|washer|dryer|stove)\b/.test(text) ||
    /\b(large|bulky|heavy|oversized)\b/.test(text)
  );
}
