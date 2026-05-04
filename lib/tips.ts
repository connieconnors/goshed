export type TipId = "sell" | "donate" | "gift" | "electronics";

export type TipLink = {
  id: TipId;
  label: string;
  title: string;
};

export const TIP_LINKS: Record<TipId, TipLink> = {
  sell: {
    id: "sell",
    label: "Selling Tips",
    title: "Selling Tips",
  },
  donate: {
    id: "donate",
    label: "Donation Tips",
    title: "Donation Tips",
  },
  gift: {
    id: "gift",
    label: "Gifting Ideas",
    title: "Gifting Ideas",
  },
  electronics: {
    id: "electronics",
    label: "Electronics Tips",
    title: "Electronics Tips",
  },
};

export function getRecommendationTip(recommendation: string | undefined): TipLink | null {
  const rec = recommendation?.trim().toLowerCase();
  if (rec === "sell") return TIP_LINKS.sell;
  if (rec === "donate") return TIP_LINKS.donate;
  if (rec === "gift") return TIP_LINKS.gift;
  return null;
}

export function isElectronicsTipCandidate(itemLabel: string | undefined): boolean {
  if (!itemLabel?.trim()) return false;
  return /\b(electronics?|tv|television|monitor|computer|desktop|laptop|tablet|ipad|phone|smartphone|iphone|android|printer|scanner|stereo|receiver|speaker|dvd player|blu[-\s]?ray|vcr|camera|game console|xbox|playstation|nintendo)\b/i.test(
    itemLabel
  );
}

export function getTipsForItem(item: {
  recommendation?: string;
  item_label?: string;
}): TipLink[] {
  const tips: TipLink[] = [];
  const recommendationTip = getRecommendationTip(item.recommendation);
  if (recommendationTip) tips.push(recommendationTip);
  if (isElectronicsTipCandidate(item.item_label)) tips.push(TIP_LINKS.electronics);
  return tips;
}
