"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { ProofSections } from "@/components/marketing/proof-sections";
import { PaymentChoiceButton } from "@/components/payment/payment-choice-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PRICING_PLANS, type PricingPlan } from "@/lib/plans";
import {
  CheckCircle2,
  ChevronRight,
  Crown,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";

const ACCENT_STYLES: Record<PricingPlan["accent"], {
  card: string;
  icon: string;
  check: string;
  button: string;
  badge: string;
  mutedFeature: string;
}> = {
  neutral: {
    card: "border-[rgb(var(--border))] hover:border-[rgb(var(--primary)/0.3)] hover:shadow-md",
    icon: "bg-violet-100 text-violet-600",
    check: "text-emerald-600",
    button: "border-[rgb(var(--border))] bg-white text-[rgb(var(--foreground))] hover:bg-[rgb(var(--surface-elevated))]",
    badge: "bg-[rgb(var(--primary))] text-white",
    mutedFeature: "text-[rgb(var(--muted-foreground))]",
  },
  blue: {
    card: "border-[rgb(var(--primary))] shadow-xl shadow-[rgb(var(--primary)/0.12)]",
    icon: "bg-[#E8F3FF] text-[#2F7FC1]",
    check: "text-[#2F7FC1]",
    button: "bg-[#1473E6] text-white hover:bg-[#0f62c4]",
    badge: "bg-[rgb(var(--primary))] text-white",
    mutedFeature: "text-[#2F7FC1]",
  },
  gold: {
    card: "border-[rgb(var(--border))] hover:border-amber-300 hover:shadow-md",
    icon: "bg-amber-50 text-amber-700",
    check: "text-amber-600",
    button: "bg-[rgb(var(--foreground))] text-white hover:bg-[rgb(var(--foreground)/0.88)]",
    badge: "bg-[rgb(var(--secondary))] text-white",
    mutedFeature: "text-amber-700",
  },
};

function PlanCard({ plan }: { plan: PricingPlan }) {
  const styles = ACCENT_STYLES[plan.accent];
  const afterDivider = plan.accent === "blue" ? 5 : plan.accent === "gold" ? 1 : null;

  return (
    <article className="relative flex h-full flex-col">
      {plan.badge && (
        <div className={cn("absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold shadow-sm", styles.badge)}>
          {plan.badge}
        </div>
      )}
      <div className={cn("relative flex h-full flex-col gap-5 overflow-hidden rounded-2xl border bg-[rgb(var(--surface))] p-6 transition-all", styles.card)}>
        {plan.accent === "blue" && (
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{ background: "linear-gradient(180deg, rgb(var(--primary)/0.05) 0%, transparent 60%)" }}
          />
        )}

        <div className="relative">
          <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-xl", styles.icon)}>
            {plan.accent === "gold" ? <Crown className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
          </div>

          <div className="text-sm font-bold text-[rgb(var(--muted-foreground))]">{plan.eyebrow}</div>
          <h2 className="mt-1 text-2xl font-bold text-[rgb(var(--foreground))]">{plan.name}</h2>
          <div className="mt-4 flex items-end gap-1">
            <span className="text-4xl font-bold tracking-normal text-[rgb(var(--foreground))]">${plan.price}</span>
            <span className="mb-1 text-sm text-[rgb(var(--muted-foreground))]">{plan.periodLabel}</span>
          </div>
          <p className="mt-1 text-xs font-medium text-[rgb(var(--muted-foreground))]">{plan.priceKztLabel}</p>
          {plan.monthlyLabel && (
            <p className="mt-1 text-xs font-medium text-[rgb(var(--success))]">{plan.monthlyLabel}</p>
          )}
        </div>

        <ul className="relative flex flex-1 flex-col gap-2.5">
          {plan.included.map((feature, index) => (
            <li key={feature} className={cn("flex gap-2 text-sm leading-6 text-[rgb(var(--foreground))]", afterDivider === index && "border-t border-[rgb(var(--border))] pt-4")}>
              <CheckCircle2 className={cn("mt-1 h-4 w-4 shrink-0", styles.check)} />
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
          <ul className="relative flex flex-col gap-2.5 border-t border-[rgb(var(--border))] pt-4">
            {plan.excluded.map((feature) => (
              <li key={feature} className="flex gap-2 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
                <X className="mt-1 h-4 w-4 shrink-0 text-[rgb(var(--muted-foreground))]" />
                {feature}
              </li>
            ))}
          </ul>
        )}

        <PaymentChoiceButton planId={plan.id} className={cn("relative mt-auto h-10 w-full rounded-xl text-sm shadow-sm", styles.button)} />
      </div>
    </article>
  );
}

export default function PricingPage() {
  return (
    <AppShell title="Тарифы">
      <main className="mx-auto flex max-w-6xl flex-col gap-12 py-6">
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

        <section className="grid gap-5 md:grid-cols-3">
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

        <section className="grid gap-4 rounded-2xl border border-emerald-100 bg-[#F7F6EF] p-6 shadow-sm md:grid-cols-[auto_1fr_auto] md:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm shadow-emerald-500/20">
            <Users className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[rgb(var(--foreground))]">Хочешь готовиться с преподавателем?</h2>
            <p className="mt-1 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
              Групповые и индивидуальные занятия с IELTS-экспертами. Гарантия +1.5 band за 3 месяца.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl border-[rgb(var(--border))] bg-white hover:bg-[rgb(var(--surface-elevated))]">
            <Link href="/live">
              Узнать подробнее
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>

        <ProofSections />

        <section className="rounded-2xl bg-gradient-to-r from-[rgb(var(--primary))] to-violet-500 p-8 text-center text-white">
          <h2 className="mb-2 text-xl font-bold">Готовы начать подготовку?</h2>
          <p className="mx-auto mb-5 max-w-md text-sm text-white/80">
            Нажмите оплатить, и мы откроем защищённую страницу оплаты Lava.
          </p>
          <PaymentChoiceButton
            planId="pro_quarterly"
            className="h-12 rounded-xl bg-white px-6 text-sm font-semibold text-[rgb(var(--primary))] shadow-none hover:bg-white/90"
          />
        </section>
      </main>
    </AppShell>
  );
}
