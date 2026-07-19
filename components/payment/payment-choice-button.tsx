"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { CreditCard, MessageCircle, Send, X } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { PAYMENT_CTA_LABEL, PAYMENT_OPTIONS } from "@/lib/contact";
import { cn } from "@/lib/utils";

type PaymentChoiceButtonProps = Pick<ButtonProps, "variant" | "size"> & {
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
};

export function PaymentChoiceButton({
  children = PAYMENT_CTA_LABEL,
  className,
  icon = <CreditCard className="h-4 w-4" />,
  size,
  variant,
}: PaymentChoiceButtonProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

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
  }, [open]);

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        {icon}
        {children}
      </Button>

      {open && (
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
                  Связаться для оплаты
                </h2>
                <p id={descriptionId} className="mt-1 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
                  Выберите удобный мессенджер — менеджер поможет с оплатой.
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
    </>
  );
}
