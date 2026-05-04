import { clearGuestTrialState } from "./guestGateStorage";

export const GUEST_SHED_ITEMS_KEY = "goshed_guest_shed_items";
const GUEST_SHED_MIGRATION_LOCK_KEY = "goshed_guest_shed_migration_lock";

const VALID_RECOMMENDATIONS = ["sell", "donate", "gift", "curb", "keep", "repurpose"] as const;

export type GuestShedItem = {
  client_id: string;
  photo_url: string | null;
  item_label: string;
  value_range_raw: string;
  recommendation: (typeof VALID_RECOMMENDATIONS)[number];
  notes?: string | null;
  created_at: string;
};

type GuestShedItemInput = Omit<GuestShedItem, "client_id" | "created_at" | "recommendation"> & {
  client_id?: string;
  created_at?: string;
  recommendation: string;
};

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRecommendation(value: string): GuestShedItem["recommendation"] | null {
  const rec = value.trim().toLowerCase();
  return VALID_RECOMMENDATIONS.includes(rec as GuestShedItem["recommendation"])
    ? (rec as GuestShedItem["recommendation"])
    : null;
}

export function getGuestShedItems(): GuestShedItem[] {
  if (!storageAvailable()) return [];
  const raw = localStorage.getItem(GUEST_SHED_ITEMS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is GuestShedItem => {
      if (typeof item !== "object" || item === null) return false;
      const row = item as Record<string, unknown>;
      return (
        typeof row.client_id === "string" &&
        typeof row.item_label === "string" &&
        typeof row.value_range_raw === "string" &&
        typeof row.recommendation === "string" &&
        normalizeRecommendation(row.recommendation) !== null &&
        typeof row.created_at === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeGuestShedItems(items: GuestShedItem[]) {
  if (!storageAvailable()) return;
  localStorage.setItem(GUEST_SHED_ITEMS_KEY, JSON.stringify(items));
}

function tryWriteWithPhotoFallback(items: GuestShedItem[], clientId: string) {
  try {
    writeGuestShedItems(items);
  } catch {
    const withoutPhoto = items.map((item) =>
      item.client_id === clientId ? { ...item, photo_url: null } : item
    );
    writeGuestShedItems(withoutPhoto);
  }
}

export function hasGuestShedItems(): boolean {
  return getGuestShedItems().length > 0;
}

export function addGuestShedItem(input: GuestShedItemInput): string | null {
  if (!storageAvailable()) return null;
  const recommendation = normalizeRecommendation(input.recommendation);
  if (!recommendation || !input.item_label.trim() || !input.value_range_raw.trim()) return null;

  const clientId = input.client_id ?? newClientId();
  const nextItem: GuestShedItem = {
    client_id: clientId,
    photo_url: input.photo_url ?? null,
    item_label: input.item_label,
    value_range_raw: input.value_range_raw,
    recommendation,
    notes: input.notes ?? null,
    created_at: input.created_at ?? new Date().toISOString(),
  };

  const existing = getGuestShedItems();
  const index = existing.findIndex((item) => item.client_id === clientId);
  const next = index >= 0
    ? existing.map((item) => (item.client_id === clientId ? { ...item, ...nextItem } : item))
    : [nextItem, ...existing].slice(0, 10);

  tryWriteWithPhotoFallback(next, clientId);
  return clientId;
}

export function updateGuestShedItem(
  clientId: string | null,
  updates: { recommendation?: string; notes?: string | null }
) {
  if (!clientId || !storageAvailable()) return;
  const existing = getGuestShedItems();
  const next = existing.map((item) => {
    if (item.client_id !== clientId) return item;
    const recommendation = updates.recommendation
      ? normalizeRecommendation(updates.recommendation)
      : item.recommendation;
    return {
      ...item,
      recommendation: recommendation ?? item.recommendation,
      notes: updates.notes === undefined ? item.notes : updates.notes,
    };
  });
  writeGuestShedItems(next);
}

export function clearGuestShedItems() {
  if (!storageAvailable()) return;
  localStorage.removeItem(GUEST_SHED_ITEMS_KEY);
}

export async function migrateGuestShedItemsToAccount(): Promise<{
  total: number;
  migrated: number;
  failed: number;
}> {
  if (!storageAvailable()) return { total: 0, migrated: 0, failed: 0 };
  const items = getGuestShedItems();
  if (items.length === 0) return { total: 0, migrated: 0, failed: 0 };
  if (localStorage.getItem(GUEST_SHED_MIGRATION_LOCK_KEY) === "1") {
    for (const delay of [150, 300, 600, 1000]) {
      await sleep(delay);
      if (localStorage.getItem(GUEST_SHED_MIGRATION_LOCK_KEY) !== "1") {
        const remaining = getGuestShedItems().length;
        return { total: items.length, migrated: items.length - remaining, failed: remaining };
      }
    }
    return { total: items.length, migrated: 0, failed: items.length };
  }

  localStorage.setItem(GUEST_SHED_MIGRATION_LOCK_KEY, "1");
  const failedItems: GuestShedItem[] = [];
  let migrated = 0;

  try {
    for (const item of items) {
      try {
        const res = await fetch("/api/items", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photo_url: item.photo_url ?? undefined,
            item_label: item.item_label,
            value_range_raw: item.value_range_raw,
            recommendation: item.recommendation,
            notes: item.notes ?? undefined,
          }),
        });
        if (!res.ok) {
          failedItems.push(item);
          continue;
        }
        migrated += 1;
      } catch {
        failedItems.push(item);
      }
    }

    if (failedItems.length === 0) {
      clearGuestShedItems();
      clearGuestTrialState();
    } else {
      writeGuestShedItems(failedItems);
    }

    return { total: items.length, migrated, failed: failedItems.length };
  } finally {
    localStorage.removeItem(GUEST_SHED_MIGRATION_LOCK_KEY);
  }
}
