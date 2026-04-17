/**
 * Contextual donation suggestions (Google Places) and item classification helpers.
 */

import { parseValueRange } from "@/lib/parseValueRange";

/** User-facing hint for charitable vehicle / large-item / high-value donation paths (recommend copy, etc.). */
export const CAR_DONATION_TAX_HINT =
  "Consider donating for a tax deduction — some organizations may offer pickup.";

/** Shown above ReStore / SVdP / Salvation Army pickup suggestions for bulky donate flows. */
export const BULK_PICKUP_DONATION_COPY =
  "Too big to drop off? These organizations might pick up large donations in some areas — call ahead to confirm.";

/** True if item sounds like fabric/bedding (used sheets, pillows, towels, blankets) for Places search. */
export function isFabricBedding(itemLabel: string | undefined): boolean {
  if (!itemLabel?.trim()) return false;
  const t = itemLabel.toLowerCase();
  return (
    /\b(sheet|pillowcase|pillow|blanket|towel|towels|fabric|bedding|linen)\b/.test(t) ||
    /\b(comforter|quilt|spread|rag|scraps)\b/.test(t)
  );
}

/** Medical / mobility aids — senior-center Places search only for these. */
export function isMedicalMobility(itemLabel: string | undefined): boolean {
  if (!itemLabel?.trim()) return false;
  const t = itemLabel.toLowerCase();
  return /\b(walker|wheelchair|crutches?|cane|quad cane|walking aid|hospital bed|shower chair|shower bench|bath chair|commode|bedside commode|mobility scooter|rollator|lift chair|portable oxygen|oxygen concentrator|oxygen tank|nebulizer|cpap|bed rail|geri chair)\b/.test(
    t
  );
}

/**
 * Consignment-relevant: resale upper bound over $30, or wearable clothing/accessories (not bedding/linens).
 */
export function isConsignmentContext(itemLabel: string | undefined, valueRange: string | undefined): boolean {
  if (valueRange?.trim()) {
    const { value_high } = parseValueRange(valueRange);
    if (value_high > 30) return true;
  }
  if (!itemLabel?.trim()) return false;
  const t = itemLabel.toLowerCase();
  if (/\b(sheet|pillow|blanket|towel|bedding|comforter|quilt|linen|mattress pad)\b/.test(t)) return false;
  return (
    /\b(clothing|apparel|shirt|blouse|dress|jacket|coat|shoes|boots|sneakers|heels|handbag|purse|wallet|scarf|hat|belt|jeans|skirt|sweater|cardigan|blazer|suit|tie|wristwatch|necklace|bracelet|earrings|sunglasses|backpack|tote|hand bag)\b/.test(
      t
    ) || /\b(accessories|accessory)\b/.test(t)
  );
}

function itemText(itemLabel: string | undefined, description?: string): string {
  return `${itemLabel ?? ""} ${description ?? ""}`.toLowerCase();
}

/** Cars, trucks, motorcycles, boats, RVs — organizations that accept vehicle donation. */
export function isVehicleDonationItem(itemLabel: string | undefined, description?: string): boolean {
  const t = itemText(itemLabel, description);
  if (/\bcar seat\b/.test(t)) return false;
  if (/\b(model car|toy car|diecast car)\b/.test(t)) return false;
  return (
    /\b(car|truck|suv|van|minivan|pickup truck|pickup\b|motorcycle|automobile|vehicle|jeep|sedan|hatchback|coupe|convertible)\b/.test(
      t
    ) || /\b(boat|rv\b|recreational vehicle|camper|travel trailer)\b/.test(t)
  );
}

/** Large kitchen / laundry appliances often handled by pickup donation programs. */
export function isLargeApplianceDonationItem(itemLabel: string | undefined, description?: string): boolean {
  const t = itemText(itemLabel, description);
  return /\b(refrigerator|fridge|freezer|washer|washing machine|dryer|stove|oven|range|dishwasher)\b/.test(t);
}

/**
 * Charitable pickup / tax-deduction angle: vehicles, large appliances, or resale value over $200.
 */
export function isCarDonationContext(
  itemLabel: string | undefined,
  valueRange: string | undefined,
  description?: string
): boolean {
  if (isVehicleDonationItem(itemLabel, description)) return true;
  if (isLargeApplianceDonationItem(itemLabel, description)) return true;
  if (valueRange?.trim()) {
    const { value_high } = parseValueRange(valueRange);
    if (value_high > 200) return true;
  }
  return false;
}

/**
 * Google Places text search query for car/appliance/high-value charitable donation (null if not applicable).
 */
export function getCarDonationPlacesQuery(
  itemLabel: string | undefined,
  valueRange: string | undefined,
  description?: string
): string | null {
  if (!isCarDonationContext(itemLabel, valueRange, description)) return null;
  if (isVehicleDonationItem(itemLabel, description)) return "vehicle donation charity";
  if (isLargeApplianceDonationItem(itemLabel, description)) return "appliance donation pickup";
  if (valueRange?.trim() && parseValueRange(valueRange).value_high > 200) return "charity donation pickup";
  return null;
}

/** Returns the best Google Places search query for donate/gift from item text. */
export function getPlacesSearchQuery(itemLabel: string, description?: string, valueRange?: string): string {
  const text = `${itemLabel ?? ""} ${description ?? ""}`.toLowerCase();

  const carQuery = getCarDonationPlacesQuery(itemLabel, valueRange, description);
  if (carQuery) return carQuery;

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

  if (/\b(electronics?|tv|television|computer|laptop|phone|monitor|printer)\b/.test(text)) {
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

/**
 * Furniture, appliances, exercise equipment, large rugs, mattresses, or large TVs — orgs that
 * sometimes schedule donation pickup (ReStore, SVdP, Salvation Army). Never true for textiles,
 * clothing, blankets, or small items alone. Not used for animal shelters (drop-off only).
 */
export function isBulkyPickupDonationContext(itemLabel: string | undefined, description?: string): boolean {
  if (isVehicleDonationItem(itemLabel, description)) return false;
  const t = itemText(itemLabel, description);

  const looksLikeShelterRescueDropoff =
    /\b(animal shelter|animal rescue|humane society|spca|dog rescue|cat rescue|wildlife)\b/.test(t);
  if (looksLikeShelterRescueDropoff) return false;

  const softGoodsOnly =
    /\b(textiles?|clothing|clothes|apparel|shirt|blouse|dress|skirt|pants|jeans|jacket|coat|sweater|hoodie|cardigan|socks?|underwear|lingerie|blanket|throw|comforter|quilt|duvet|towel|towels|bedding|linens?|pillow|pillows|sheets?|scarf|mittens|tablecloth|napkins?|fabric\s+scraps?)\b/.test(
      t
    ) &&
    !/\b(furniture|sofa|couch|sectional|loveseat|futon|mattress|appliance|refrigerator|fridge|freezer|washer|washing machine|dryer|stove|dresser|bookshelf|treadmill|television|tv\b|entertainment center)\b/.test(
      t
    ) &&
    !/\b(area rug|oriental rug|persian rug|large rug|room\s*sized rug)\b/.test(t) &&
    !/\brug\b.*\b(large|oversized|heavy|8\s*x|9\s*x|10\s*x|9x12|8x10)\b/.test(t) &&
    !/\b(large|oversized|heavy)\b.*\brug\b/.test(t);
  if (softGoodsOnly) return false;

  if (
    /\b(phone|smartphone|iphone|android)\b/.test(t) ||
    /\b(tablet|ipad|kindle)\b/.test(t) ||
    /\b(laptop|notebook computer|chromebook)\b/.test(t) ||
    /\b(headphones?|earbuds?|airpods?|mouse|keyboard|webcam|router)\b/.test(t) ||
    /\b(curtain|curtains|drape|pillowcase|kitchen rug|bath mat|doormat)\b/.test(t)
  ) {
    return false;
  }
  return (
    /\b(furniture|sofa|couch|sectional|loveseat|futon|table|desk|bed frame|bed\b|mattress|dresser|cabinet|bookshelf|bookcase|armoire|wardrobe|buffet|hutch|dining set)\b/.test(
      t
    ) ||
    /\b(appliance|refrigerator|fridge|freezer|washer|washing machine|dryer|stove|oven|range|dishwasher)\b/.test(t) ||
    /\b(treadmill|elliptical|rowing machine|exercise bike|stationary bike|spin bike|home gym|weight bench|smith machine|gym equipment|workout equipment|weight|weights)\b/.test(
      t
    ) ||
    /\b(tv|television|flat screen|plasma|curved tv|hdtv|big screen|entertainment center)\b/.test(t) ||
    /\b(area rug|oriental rug|persian rug|large rug|room\s*sized rug)\b/.test(t) ||
    (/\brug\b/.test(t) && /\b(large|oversized|heavy|8\s*x|9\s*x|10\s*x|9x12|8x10)\b/.test(t)) ||
    /\b(large|bulky|heavy|oversized)\b/.test(t)
  );
}
