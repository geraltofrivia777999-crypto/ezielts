"use client";

import Link from "next/link";
import { ProofSections } from "@/components/marketing/proof-sections";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PRICING_PLANS, type PricingPlan } from "@/lib/plans";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Crown,
  Shield,
  Sparkles,
  X,
} from "lucide-react";

const ACCENT_STYLES: Record<PricingPlan["accent"], {
  card: string;
  icon: string;
  check: string;
  button: string;
  mutedFeature: string;
}> = {
  neutral: {
    card: "border-[rgb(var(--border))]",
    icon: "bg-[rgb(var(--surface-elevated))] text-[rgb(var(--foreground))]",
    check: "text-emerald-600",
    button: "border-[rgb(var(--border))] bg-white text-[rgb(var(--foreground))] hover:bg-[rgb(var(--surface-elevated))]",
    mutedFeature: "text-[rgb(var(--muted-foreground))]",
  },
  blue: {
    card: "border-[#2F7FC1] shadow-xl shadow-[#2F7FC1]/10 ring-2 ring-[#2F7FC1]",
    icon: "bg-[#E8F3FF] text-[#2F7FC1]",
    check: "text-[#2F7FC1]",
    button: "bg-[#1473E6] text-white hover:bg-[#0f62c4]",
    mutedFeature: "text-[#2F7FC1]",
  },
  gold: {
    card: "border-[rgb(var(--border))]",
    icon: "bg-amber-50 text-amber-700",
    check: "text-amber-600",
    button: "bg-[rgb(var(--foreground))] text-white hover:bg-[rgb(var(--foreground)/0.88)]",
    mutedFeature: "text-amber-700",
  },
};

function PlanCard({ plan }: { plan: PricingPlan }) {
  const styles = ACCENT_STYLES[plan.accent];
  const afterDivider = plan.accent === "blue" ? 5 : plan.accent === "gold" ? 1 : null;

  return (
    <article className="relative flex h-full flex-col">
      {plan.badge && (
        <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#DCEBFA] px-4 py-1 text-sm font-bold text-[#2F6EA8] shadow-sm">
          {plan.badge}
        </div>
      )}
      <div className={cn("flex h-full flex-col rounded-2xl border bg-white p-7 shadow-sm", styles.card)}>
        <div className={cn("mb-6 flex h-12 w-12 items-center justify-center rounded-2xl", styles.icon)}>
          {plan.accent === "gold" ? <Crown className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        </div>

        <div className="text-sm font-bold text-[rgb(var(--muted-foreground))]">{plan.eyebrow}</div>
        <h2 className="mt-1 text-2xl font-bold text-[rgb(var(--foreground))]">{plan.name}</h2>
        <div className="mt-3 flex items-end gap-1">
          <span className="text-5xl font-black tracking-normal text-[rgb(var(--foreground))]">${plan.price}</span>
          <span className="pb-2 text-sm text-[rgb(var(--muted-foreground))]">{plan.periodLabel}</span>
        </div>
        {plan.monthlyLabel && (
          <p className="mt-3 text-sm font-bold text-emerald-700">{plan.monthlyLabel}</p>
        )}

        <ul className="mt-8 flex flex-1 flex-col gap-4">
          {plan.included.map((feature, index) => (
            <li key={feature} className={cn("flex gap-3 text-base leading-6 text-[rgb(var(--foreground))]", afterDivider === index && "border-t border-[rgb(var(--border))] pt-5")}>
              <Check className={cn("mt-1 h-4 w-4 shrink-0", styles.check)} />
              <span className={cn(index >= 5 || plan.accent === "gold" ? styles.mutedFeature : "")}>
                {feature.includes("безлимит") || feature.includes("продвинутый") || feature.includes("Персональный") ? (
                  <>
                    {feature.split(/(безлимит|продвинутый|Персональный)/).map((part) => (
                      part === "безлимит" || part === "продвинутый" || part === "Персональный"
                        ? <strong key={part} className="font-black text-[rgb(var(--foreground))]">{part}</strong>
                        : part
                    ))}
                  </>
                ) : feature}
              </span>
            </li>
          ))}
        </ul>

        {plan.excluded && plan.excluded.length > 0 && (
          <ul className="mt-6 flex flex-col gap-3 border-t border-[rgb(var(--border))] pt-5">
            {plan.excluded.map((feature) => (
              <li key={feature} className="flex gap-3 text-base leading-6 text-[rgb(var(--muted-foreground))]">
                <X className="mt-1 h-4 w-4 shrink-0 text-[rgb(var(--muted-foreground))]" />
                {feature}
              </li>
            ))}
          </ul>
        )}

        <Button asChild className={cn("mt-8 h-12 w-full rounded-xl text-base shadow-sm", styles.button)}>
          <Link href={plan.checkoutHref}>
            <CreditCard className="h-4 w-4" />
            Выбрать тариф
          </Link>
        </Button>
      </div>
    </article>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[rgb(var(--background))]">
      <header className="sticky top-0 z-40 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
            <ChevronLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="ml-2 flex items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[rgb(var(--primary))]">
              <span className="text-xs font-bold text-white">EZ</span>
            </div>
            <span className="font-semibold text-[rgb(var(--foreground))]">ielts</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-12">
        <section className="text-center">
          <Badge variant="default" className="mb-4 gap-1.5 px-3 py-1">
            <Sparkles className="h-3 w-3" />
            Тарифы IELTS подготовки
          </Badge>
          <h1 className="text-3xl font-black tracking-normal text-[rgb(var(--foreground))] md:text-5xl">
            Выберите срок подготовки
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[rgb(var(--muted-foreground))]">
            Один месяц для старта, три месяца для системной подготовки, 12 месяцев для максимального доступа ко всем инструментам платформы.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          {PRICING_PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </section>

        <section className="grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm md:grid-cols-[auto_1fr_auto] md:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <Shield className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[rgb(var(--foreground))]">Гарантия +1 балл</h2>
            <p className="mt-1 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
              При подписке на 3 месяца или 12 месяцев: если Overall Band Score не вырастет на 1.0 пункт при соблюдении условий, возвращаем <strong className="text-[rgb(var(--foreground))]">100% оплаты</strong>.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl border-emerald-200 bg-white hover:bg-emerald-50">
            <Link href="/guarantee">
              Подробнее
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>

        <ProofSections />
      </main>
    </div>
  );
}
