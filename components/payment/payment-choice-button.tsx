"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { CreditCard, MessageCircle, Send, X } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { PAYMENT_CTA_LABEL, PAYMENT_OPTIONS } from "@/lib/contact";
import type { PaidPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";

type PaymentChoiceButtonProps = Pick<ButtonProps, "variant" | "size"> & {
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
  mode?: "lava" | "messenger";
  planId?: PaidPlan;
};

export function PaymentChoiceButton({
  children = PAYMENT_CTA_LABEL,
  className,
  icon = <CreditCard className="h-4 w-4" />,
  mode = "lava",
  planId = "pro_quarterly",
  size,
  variant,
}: PaymentChoiceButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (mode !== "messenger" || !open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mode, open]);

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

      window.localStorage.setItem("ieltszen:pending-lava-payment", "1");
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
        disabled={mode === "lava" && loading}
        onClick={mode === "messenger" ? () => setOpen(true) : startPayment}
      >
        {icon}
        {mode === "lava" && loading ? "Открываем оплату..." : children}
      </Button>

      {mode === "messenger" && open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-xl font-bold text-[rgb(var(--foreground))]">
                  Выберите способ оплаты
                </h2>
                <p id={descriptionId} className="mt-1 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
                  Живое обучение оплачивается через менеджера. Выберите удобный мессенджер.
                </p>
              </div>
              <button
                type="button"
                aria-label="Закрыть"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] transition-colors hover:bg-[rgb(var(--surface-elevated))] hover:text-[rgb(var(--foreground))]"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3">
              {PAYMENT_OPTIONS.map((option) => {
                const isTelegram = option.href.includes("t.me");
                return (
                  <a
                    key={option.href}
                    href={option.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-4 text-left transition-[background-color,border-color,transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md",
                      isTelegram
                        ? "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
                        : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                    )}
                  >
                    <span className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                      isTelegram ? "bg-sky-500" : "bg-emerald-500"
                    )}>
                      {isTelegram ? <Send className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
                    </span>
                    <span>
                      <span className="block font-bold">{option.label}</span>
                      <span className="mt-0.5 block text-xs opacity-75">{option.description}</span>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-lg" role="alert">
          {error}
        </div>
      )}
    </>
  );
}
