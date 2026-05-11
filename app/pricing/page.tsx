"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Zap,
  Shield,
  Star,
  ChevronRight,
  CreditCard,
} from "lucide-react";

// ─── Plans config ─────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: { monthly: 0, annual: 0 },
    description: "Для знакомства с платформой",
    cta: "Текущий план",
    ctaHref: "/dashboard",
    highlight: false,
    tag: null,
  },
  {
    id: "pro_monthly",
    name: "Pro",
    price: { monthly: 8, annual: 8 },
    description: "Серьёзная подготовка",
    cta: "Начать Pro",
    ctaHref: "/checkout?plan=pro_monthly",
    highlight: true,
    tag: null,
  },
  {
    id: "pro_annual",
    name: "Pro Год",
    price: { monthly: 4, annual: 48 },
    description: "Лучшая ценность",
    cta: "Начать годовой план",
    ctaHref: "/checkout?plan=pro_annual",
    highlight: false,
    tag: "ЛУЧШАЯ ЦЕНА",
  },
];

const FEATURES = [
  {
    label: "Reading тесты",
    free: "1 в день",
    pro: "Безлимит",
    highlight: false,
  },
  {
    label: "Listening тесты",
    free: "1 в день",
    pro: "Безлимит",
    highlight: false,
  },
  {
    label: "Writing задания",
    free: "1 в неделю (без AI)",
    pro: "Безлимит + AI Feedback",
    highlight: true,
  },
  {
    label: "Speaking тесты",
    free: "1 в неделю (без AI)",
    pro: "Безлимит + AI Coach",
    highlight: true,
  },
  {
    label: "AI Writing Feedback",
    free: false,
    pro: true,
    highlight: false,
  },
  {
    label: "AI Speaking Coach",
    free: false,
    pro: true,
    highlight: false,
  },
  {
    label: "Персональный план",
    free: false,
    pro: true,
    highlight: false,
  },
  {
    label: "Анализ ошибок",
    free: "Базовый",
    pro: "Детальный",
    highlight: false,
  },
  {
    label: "AI Tutor",
    free: "3 вопроса (lifetime)",
    pro: "Безлимит",
    highlight: false,
  },
  {
    label: "Гарантия +1 балл",
    free: false,
    pro: true,
    highlight: false,
  },
  {
    label: "Приоритетная поддержка",
    free: false,
    pro: true,
    highlight: false,
  },
];

const TESTIMONIALS = [
  { name: "Алия М.", city: "Алматы", before: 5.5, after: 7.0 },
  { name: "Дмитрий К.", city: "Бишкек", before: 6.0, after: 7.5 },
  { name: "Санжар Б.", city: "Ташкент", before: 6.5, after: 8.0 },
];

// ─── Feature cell ─────────────────────────────────────────────────────────────

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true) return <CheckCircle2 className="w-4 h-4 text-[rgb(var(--success))] mx-auto" />;
  if (value === false) return <XCircle className="w-4 h-4 text-[rgb(var(--muted))] mx-auto" />;
  return <span className="text-sm text-[rgb(var(--foreground))]">{value}</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  return (
    <div className="min-h-screen bg-[rgb(var(--background))]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
            <ChevronLeft className="w-4 h-4" />Dashboard
          </Link>
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-6 h-6 rounded bg-[rgb(var(--primary))] flex items-center justify-center">
              <span className="text-white font-bold text-xs">EZ</span>
            </div>
            <span className="font-semibold text-[rgb(var(--foreground))]">ielts</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-12 flex flex-col gap-14">

        {/* Hero */}
        <div className="text-center">
          <Badge variant="default" className="mb-4 gap-1.5 py-1 px-3">
            <Zap className="w-3 h-3" />
            Выбери свой план
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-[rgb(var(--foreground))] mb-3">
            Прозрачные цены, реальный результат
          </h1>
          <p className="text-[rgb(var(--muted-foreground))] max-w-lg mx-auto">
            Начни бесплатно. Переходи на Pro когда будешь готов — без скрытых платежей, отмена в любой момент.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 mt-6 bg-[rgb(var(--surface-elevated))] p-1 rounded-xl">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                billing === "monthly"
                  ? "bg-[rgb(var(--surface))] text-[rgb(var(--foreground))] shadow-sm"
                  : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
              )}
            >
              Ежемесячно
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5",
                billing === "annual"
                  ? "bg-[rgb(var(--surface))] text-[rgb(var(--foreground))] shadow-sm"
                  : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
              )}
            >
              Годовой
              <span className="text-[10px] font-bold text-white bg-[rgb(var(--secondary))] px-1.5 py-0.5 rounded-full">−50%</span>
            </button>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const price = billing === "annual" ? plan.price.annual : plan.price.monthly;
            const isMonthlyDisplay = billing === "monthly" || plan.id === "free";

            return (
              <div key={plan.id} className="relative">
                {plan.tag && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap z-10"
                    style={{ background: "rgb(var(--secondary))" }}
                  >
                    {plan.tag}
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-2xl border bg-[rgb(var(--surface))] p-6 flex flex-col gap-5 h-full transition-all",
                    plan.highlight
                      ? "border-[rgb(var(--primary))] shadow-xl shadow-[rgb(var(--primary)/0.12)]"
                      : "border-[rgb(var(--border))] hover:border-[rgb(var(--primary)/0.3)] hover:shadow-sm"
                  )}
                >
                  {plan.highlight && (
                    <div className="absolute inset-0 rounded-2xl pointer-events-none"
                      style={{ background: "linear-gradient(180deg, rgb(var(--primary)/0.04) 0%, transparent 100%)" }} />
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[rgb(var(--muted-foreground))]">{plan.name}</span>
                      {plan.highlight && <Badge variant="default" className="text-[10px]">Популярный</Badge>}
                    </div>
                    <div className="flex items-end gap-1 mt-1">
                      <span className="text-4xl font-bold text-[rgb(var(--foreground))]">
                        {price === 0 ? "Free" : `$${price}`}
                      </span>
                      {price > 0 && (
                        <span className="text-[rgb(var(--muted-foreground))] mb-1 text-sm">
                          {billing === "annual" && plan.id !== "free" ? "/ год" : "/ мес"}
                        </span>
                      )}
                    </div>
                    {billing === "annual" && plan.id === "pro_annual" && (
                      <p className="text-xs text-[rgb(var(--success))] mt-0.5">~$4/мес · экономия $48</p>
                    )}
                    <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">{plan.description}</p>
                  </div>

                  <Button
                    variant={plan.id === "free" ? "outline" : "default"}
                    className="w-full"
                    asChild
                    disabled={plan.id === "free"}
                  >
                    <Link href={plan.ctaHref} className="flex items-center gap-1.5">
                      {plan.id !== "free" && <CreditCard className="w-3.5 h-3.5" />}
                      {plan.cta}
                    </Link>
                  </Button>

                  {plan.id !== "free" && (
                    <p className="text-xs text-center text-[rgb(var(--muted-foreground))] -mt-2">
                      Visa · Mastercard · Kaspi · Халык
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Guarantee banner */}
        <div className="bg-[rgb(var(--success)/0.06)] border border-[rgb(var(--success)/0.2)] rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-[rgb(var(--success)/0.12)] flex items-center justify-center shrink-0 mx-auto sm:mx-0">
            <Shield className="w-7 h-7 text-[rgb(var(--success))]" />
          </div>
          <div>
            <h3 className="font-bold text-[rgb(var(--foreground))] text-lg mb-1">Гарантия +1 балл</h3>
            <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed">
              При подписке на 3 месяца — если band не вырастет на 1 пункт, возвращаем{" "}
              <strong className="text-[rgb(var(--foreground))]">100% оплаты</strong>. Без вопросов.
            </p>
          </div>
        </div>

        {/* Feature comparison table */}
        <div>
          <h2 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-6 text-center">Полное сравнение планов</h2>
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-elevated))]">
              <div className="p-4 text-sm font-semibold text-[rgb(var(--foreground))]">Функция</div>
              <div className="p-4 text-sm font-semibold text-[rgb(var(--muted-foreground))] text-center">Free</div>
              <div className="p-4 text-sm font-semibold text-[rgb(var(--primary))] text-center flex items-center justify-center gap-1">
                <Zap className="w-3.5 h-3.5" />Pro
              </div>
            </div>
            {FEATURES.map(({ label, free, pro, highlight }, i) => (
              <div
                key={label}
                className={cn(
                  "grid grid-cols-3 border-b border-[rgb(var(--border))] last:border-0 transition-colors",
                  highlight ? "bg-[rgb(var(--primary)/0.03)]" : i % 2 === 0 ? "" : "bg-[rgb(var(--surface-elevated)/0.5)]"
                )}
              >
                <div className={cn("p-4 text-sm", highlight ? "font-medium text-[rgb(var(--foreground))]" : "text-[rgb(var(--foreground))]")}>
                  {label}
                  {highlight && <span className="ml-1.5 text-[10px] text-[rgb(var(--primary))] font-semibold uppercase">Pro</span>}
                </div>
                <div className="p-4 text-center flex items-center justify-center">
                  <FeatureCell value={free} />
                </div>
                <div className="p-4 text-center flex items-center justify-center">
                  <FeatureCell value={pro} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Social proof */}
        <div>
          <h2 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-6 text-center">Pro студенты достигают результатов</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ name, city, before, after }) => (
              <div key={name} className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-2xl font-bold text-[rgb(var(--band-mid))]">{before}</span>
                  <span className="text-[rgb(var(--muted-foreground))]">→</span>
                  <span className="font-mono text-2xl font-bold text-[rgb(var(--band-high))]">{after}</span>
                  <Badge variant="success" className="ml-auto">+{(after - before).toFixed(1)}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-auto pt-2 border-t border-[rgb(var(--border))]">
                  <div className="w-7 h-7 rounded-full bg-[rgb(var(--primary))] flex items-center justify-center text-white text-xs font-bold">
                    {name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[rgb(var(--foreground))]">{name}</div>
                    <div className="text-xs text-[rgb(var(--muted))]">{city}</div>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 text-[rgb(var(--warning))] fill-current" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto w-full">
          <h2 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-6 text-center">Вопросы об оплате</h2>
          <div className="flex flex-col gap-4">
            {[
              { q: "Можно ли отменить подписку?", a: "Да, в любой момент из настроек аккаунта. После отмены доступ сохраняется до конца оплаченного периода." },
              { q: "Какие способы оплаты доступны?", a: "Visa, Mastercard, Kaspi Gold, Халык Банк, и другие казахстанские карты. Международные карты тоже принимаем." },
              { q: "Есть ли пробный период Pro?", a: "Да — 7 дней бесплатно при первой подписке. Никаких списаний до конца триала." },
              { q: "Как работает гарантия возврата?", a: "При подписке Pro на 3+ месяца: если band не вырос на 1 пункт по результатам официального теста — возвращаем 100% без вопросов." },
            ].map(({ q, a }) => (
              <div key={q} className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl p-5">
                <h3 className="font-semibold text-[rgb(var(--foreground))] mb-2">{q}</h3>
                <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div
          className="rounded-2xl p-8 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgb(var(--primary)) 0%, rgb(var(--secondary)) 100%)" }}
        >
          <div aria-hidden className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 80% 50%, rgba(255,255,255,0.1) 0%, transparent 60%)" }} />
          <h2 className="text-2xl font-bold text-white mb-2 relative">Начни подготовку сегодня</h2>
          <p className="text-white/80 mb-6 relative">7 дней Pro бесплатно — карта не нужна для триала</p>
          <Button size="xl" className="bg-white text-[rgb(var(--primary))] hover:bg-white/90 shadow-xl relative" asChild>
            <Link href="/checkout?plan=pro_monthly&trial=true">
              Начать бесплатный триал
              <ChevronRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
