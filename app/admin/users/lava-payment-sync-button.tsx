"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type SyncResponse = {
  ok?: boolean;
  checked?: number;
  activated?: number;
  pending?: number;
  failed?: number;
  alreadyDone?: number;
  reviewRequired?: number;
  errors?: number;
  error?: string;
};

function resultText(result: SyncResponse | null) {
  if (!result) return null;
  if (result.error) return "Не удалось проверить оплаты.";
  if (!result.checked) return "Новых Lava оплат для проверки нет.";

  return [
    `проверено: ${result.checked ?? 0}`,
    `активировано: ${result.activated ?? 0}`,
    `ожидают: ${result.pending ?? 0}`,
    `ошибки: ${result.errors ?? 0}`,
  ].join(" · ");
}

export function LavaPaymentSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResponse | null>(null);

  async function syncPayments() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/payments/lava/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const payload = (await response.json()) as SyncResponse;
      setResult(response.ok ? payload : { error: payload.error ?? "request_failed" });
    } catch {
      setResult({ error: "request_failed" });
    } finally {
      setLoading(false);
    }
  }

  const text = resultText(result);

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button type="button" variant="outline" size="sm" onClick={syncPayments} disabled={loading}>
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Проверяем Lava..." : "Проверить оплаты Lava"}
      </Button>
      {text && (
        <p className={`max-w-sm text-xs ${result?.error ? "text-[rgb(var(--destructive))]" : "text-[rgb(var(--muted-foreground))]"}`}>
          {text}
        </p>
      )}
    </div>
  );
}
