"use client";

import { useState, type ReactNode } from "react";
import { CreditCard } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { PAYMENT_CTA_LABEL } from "@/lib/contact";
import type { PaidPlan } from "@/lib/plans";

type PaymentChoiceButtonProps = Pick<ButtonProps, "variant" | "size"> & {
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
  planId?: PaidPlan;
};

export function PaymentChoiceButton({
  children = PAYMENT_CTA_LABEL,
  className,
  icon = <CreditCard className="h-4 w-4" />,
  planId = "pro_quarterly",
  size,
  variant,
}: PaymentChoiceButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startPayment() {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/lava/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const payload = await response.json().catch(() => null) as {
        paymentUrl?: string;
        redirectUrl?: string;
        message?: string;
      } | null;

      if (response.status === 401 && payload?.redirectUrl) {
        window.location.assign(payload.redirectUrl);
        return;
      }

      if (!response.ok || !payload?.paymentUrl) {
        throw new Error(payload?.message || "Не удалось открыть оплату.");
      }

      window.location.assign(payload.paymentUrl);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Не удалось открыть оплату.");
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        disabled={loading}
        onClick={startPayment}
      >
        {icon}
        {loading ? "Открываем оплату..." : children}
      </Button>

      {error && (
        <div className="fixed bottom-4 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-lg" role="alert">
          {error}
        </div>
      )}
    </>
  );
}
