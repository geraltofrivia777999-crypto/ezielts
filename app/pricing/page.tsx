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
  Sparkles,
  Users,
  User as UserIcon,
  MessageCircle,
  CreditCard,
  Star,
  ChevronRight,
} from "lucide-react";

// ─── Plans config ─────────────────────────────────────────────────────────────

// WhatsApp contact — change WA_NUMBER to your real number (digits only, e.g. 77001234567)
const WA_NUMBER = "77001234567";
const WA_MSG_GROUP = encodeURIComponent("Здравствуйте! Хочу записаться на групповые занятия EZielts.");
const WA_MSG_INDIVIDUAL = encodeURIComponent("Здравствуйте! Хочу записаться на индивидуальные занятия EZielts.");

type Billing = "monthly" | "quarterly";

type Plan = {
  id: "ai" | "group" | "individual";
  name: string;
  pricing: Record<Billing, { label: string; subtitle: string; savings?: string; href: string }>;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  cta: string;
  ctaExternal?: boolean;
  highlight: boolean;
  tag: string | null;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "ai",
    name: "AI Базовый",
    pricing: {
      monthly:   { label: "$8",  subtitle: "/ мес",           href: "/checkout?plan=pro_monthly" },
      quarterly: { label: "$20", subtitle: "/ 3 мес",  savings: "~$6.67/мес · экономия $4", href: "/checkout?plan=pro_quarterly" },
    },
    description: "Полная подготовка с AI-фидбеком",
    icon: Sparkles,
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    cta: "Начать с AI",
    highlight: true,
    tag: "ПОПУЛЯРНЫЙ",
    features: [
      "Безлимит Reading + Listening",
      "AI Writing Feedback (4 критерия)",
      "AI Speaking Coach + транскрипт",
      "Персональный AI-план на 14 дней",
      "Детальный анализ ошибок",
      "AI Tutor без ограничений",
    ],
  },
  {
    id: "group",
    name: "Групповые",
    pricing: {
      monthly:   { label: "от $49",  subtitle: "/ мес",   href: `https://wa.me/${WA_NUMBER}?text=${WA_MSG_GROUP}` },
      quarterly: { label: "от $129", subtitle: "/ 3 мес", href: `https://wa.me/${WA_NUMBER}?text=${WA_MSG_GROUP}` },
    },
    description: "Живые занятия в мини-группах",
    icon: Users,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    cta: "Написать в WhatsApp",
    ctaExternal: true,
    highlight: false,
    tag: null,
    features: [
      "Всё из AI Базовый",
      "3 онлайн-урока в неделю",
      "Группы по 5–8 человек",
      "Преподаватели с IELTS 8+",
      "Live Speaking практика",
      "Проверка эссе преподавателем",
    ],
  },
  {
    id: "individual",
    name: "Индивидуальные",
    pricing: {
      monthly:   { label: "от $120", subtitle: "/ мес",   href: `https://wa.me/${WA_NUMBER}?text=${WA_MSG_INDIVIDUAL}` },
      quarterly: { label: "от $320", subtitle: "/ 3 мес", href: `https://wa.me/${WA_NUMBER}?text=${WA_MSG_INDIVIDUAL}` },
    },
    description: "Персональный преподаватель 1-on-1",
    icon: UserIcon,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    cta: "Написать в WhatsApp",
    ctaExternal: true,
    highlight: false,
    tag: "МАКС. РЕЗУЛЬТАТ",
    features: [
      "Всё из Групповые",
      "Персональный преподаватель",
      "Гибкое расписание",
      "Mock-экзамены с разбором",
      "Гарантия +1.5 band за 3 мес.",
      "WhatsApp 24/7 с тьютором",
    ],
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
  const [billing, setBilling] = useState<Billing>("monthly");

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
            Выбери свой формат
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-[rgb(var(--foreground))] mb-3">
            Прозрачные цены, реальный результат
          </h1>
          <p className="text-[rgb(var(--muted-foreground))] max-w-lg mx-auto">
            От AI-практики до индивидуальных занятий с преподавателем — выбери что нужно тебе сейчас.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 mt-6 bg-[rgb(var(--surface-elevated))] p-1 rounded-xl border border-[rgb(var(--border))]">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                billing === "monthly"
                  ? "bg-[rgb(var(--surface))] text-[rgb(var(--foreground))] shadow-sm"
                  : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
              )}
            >
              1 месяц
            </button>
            <button
              onClick={() => setBilling("quarterly")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5",
                billing === "quarterly"
                  ? "bg-[rgb(var(--surface))] text-[rgb(var(--foreground))] shadow-sm"
                  : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
              )}
            >
              3 месяца
              <span className="text-[10px] font-bold text-white bg-[rgb(var(--secondary))] px-1.5 py-0.5 rounded-full">−17%</span>
            </button>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const PlanIcon = plan.icon;
            const isWhatsApp = !!plan.ctaExternal;
            const price = plan.pricing[billing];
            return (
              <div key={plan.id} className="relative">
                {plan.tag && (
                  <div
                    className={cn(
                      "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap z-10",
                      plan.highlight ? "bg-[rgb(var(--primary))]" : "bg-[rgb(var(--secondary))]"
                    )}
                  >
                    {plan.tag}
                  </div>
                )}
                <div
                  className={cn(
                    "relative rounded-2xl border bg-[rgb(var(--surface))] p-6 flex flex-col gap-5 h-full transition-all overflow-hidden",
                    plan.highlight
                      ? "border-[rgb(var(--primary))] shadow-xl shadow-[rgb(var(--primary)/0.12)]"
                      : "border-[rgb(var(--border))] hover:border-[rgb(var(--primary)/0.3)] hover:shadow-md"
                  )}
                >
                  {plan.highlight && (
                    <div
                      className="absolute inset-0 rounded-2xl pointer-events-none"
                      style={{ background: "linear-gradient(180deg, rgb(var(--primary)/0.05) 0%, transparent 60%)" }}
                    />
                  )}

                  <div className="relative">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", plan.iconBg)}>
                      <PlanIcon className={cn("w-6 h-6", plan.iconColor)} strokeWidth={2.25} />
                    </div>
                    <div className="text-lg font-bold text-[rgb(var(--foreground))]">{plan.name}</div>
                    <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">{plan.description}</p>
                    <div className="flex items-end gap-1 mt-4">
                      <span className="text-4xl font-bold text-[rgb(var(--foreground))]">{price.label}</span>
                      <span className="text-[rgb(var(--muted-foreground))] mb-1 text-sm">{price.subtitle}</span>
                    </div>
                    {price.savings && (
                      <p className="text-xs text-[rgb(var(--success))] mt-1 font-medium">
                        {price.savings}
                      </p>
                    )}
                  </div>

                  <ul className="relative flex flex-col gap-2.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2 text-sm text-[rgb(var(--foreground))]">
                        <CheckCircle2 className={cn("w-4 h-4 shrink-0 mt-0.5", plan.iconColor)} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={plan.highlight ? "default" : "outline"}
                    className={cn(
                      "w-full relative",
                      isWhatsApp && "bg-[#25D366] hover:bg-[#1faa56] text-white border-[#25D366]"
                    )}
                    asChild
                  >
                    {isWhatsApp ? (
                      <a
                        href={price.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        {plan.cta}
                      </a>
                    ) : (
                      <Link href={price.href} className="flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" />
                        {billing === "quarterly" ? "Оплатить 3 месяца" : plan.cta}
                      </Link>
                    )}
                  </Button>

                  {!isWhatsApp && (
                    <p className="text-xs text-center text-[rgb(var(--muted-foreground))] -mt-2 relative">
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
