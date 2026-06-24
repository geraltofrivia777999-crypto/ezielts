"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

type SyncResponse = {
  ok?: boolean;
  checked?: number;
  activated?: number;
};

const LAST_SYNC_KEY = "ieltszen:last-lava-auto-sync";
const PENDING_PAYMENT_KEY = "ieltszen:pending-lava-payment";
const SYNC_INTERVAL_MS = 20_000;

function shouldSync(force: boolean) {
  if (typeof window === "undefined") return false;
  if (force || window.localStorage.getItem(PENDING_PAYMENT_KEY) === "1") return true;

  const lastSync = Number(window.localStorage.getItem(LAST_SYNC_KEY) ?? "0");
  return !lastSync || Date.now() - lastSync > SYNC_INTERVAL_MS;
}

export function LavaAutoSync() {
  const router = useRouter();
  const [activated, setActivated] = useState(false);
  const syncingRef = useRef(false);

  useEffect(() => {
    async function sync(force = false) {
      if (syncingRef.current || !shouldSync(force)) return;

      syncingRef.current = true;
      window.localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));

      try {
        const response = await fetch("/api/payments/lava/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (response.status === 401) return;

        const payload = (await response.json().catch(() => null)) as SyncResponse | null;
        if (response.ok && payload?.activated && payload.activated > 0) {
          window.localStorage.removeItem(PENDING_PAYMENT_KEY);
          window.dispatchEvent(new CustomEvent("ieltszen:subscription-updated"));
          setActivated(true);
          router.refresh();
          window.setTimeout(() => setActivated(false), 7000);
        }
      } finally {
        syncingRef.current = false;
      }
    }

    sync();

    function onFocus() {
      sync(true);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") sync(true);
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  if (!activated) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[120] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-xl shadow-emerald-900/10">
      <CheckCircle2 className="h-5 w-5 shrink-0" />
      Оплата подтверждена. Подписка активирована.
    </div>
  );
}
