"use client";

import { usePathname } from "next/navigation";
import { PaywallModal } from "@/app/components/PaywallModal";
import { FREE_LOGGED_IN_ITEM_LIMIT } from "@/lib/freeTier";
import { useAuthSession } from "@/lib/auth-session-context";

export function HardPaywallGate() {
  const pathname = usePathname();
  const { user, itemCount, isPro, loading, refresh } = useAuthSession();
  const hardPaywallRequired =
    pathname !== "/" &&
    pathname !== "/shed" &&
    !loading &&
    !!user &&
    !isPro &&
    typeof itemCount === "number" &&
    itemCount >= FREE_LOGGED_IN_ITEM_LIMIT;

  return (
    <PaywallModal
      open={hardPaywallRequired}
      onClose={() => {}}
      onPurchaseSuccess={() => {
        void refresh();
      }}
      itemCount={typeof itemCount === "number" ? itemCount : FREE_LOGGED_IN_ITEM_LIMIT}
    />
  );
}
