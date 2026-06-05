"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PaymentChoiceButton } from "@/components/payment/payment-choice-button";
import { cn, formatBand } from "@/lib/utils";
import {
  BookOpen, Headphones, PenLine, Mic2, Flame,
  Target, ChevronRight, CheckCircle2,
  Zap, Star, Loader2, Sparkles, Send,
  Calendar, Edit3,
} from "lucide-react";
import { BandLineChart } from "@/app/progress/_components/band-line-chart";
import { createClient } from "@/lib/supabase/client";
import { getUserSummary, getBandHistory } from "@/lib/supabase/queries";
import type { Database } from "@/lib/supabase/types";

type UserSummary = Database["public"]["Views"]["v_user_summary"]["Row"];
type BandHistoryRow = Database["public"]["Views"]["v_band_history"]["Row"];

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const SKILL_META = [
  { key: "reading",   label: "Reading",   icon: BookOpen,   color: "text-blue-500",   bg: "bg-blue-50",   href: "/tests?skill=reading" },
  { key: "listening", label: "Listening", icon: Headphones, color: "text-purple-500", bg: "bg-purple-50", href: "/tests?skill=listening" },
  { key: "writing",   label: "Writing",   icon: PenLine,    color: "text-teal-500",   bg: "bg-teal-50",   href: "/tests?skill=writing" },
  { key: "speaking",  label: "Speaking",  icon: Mic2,       color: "text-violet-500", bg: "bg-violet-50", href: "/tests?skill=speaking" },
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserSummary | null>(null);
  const [bandHistory, setBandHistory] = useState<BandHistoryRow[]>([]);
  const [chatInput, setChatInput] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient();
        const { data: { user: authUser } } = await sb.auth.getUser();
        if (!authUser) { router.push("/login"); return; }
        const [summary, history] = await Promise.all([
          getUserSummary(sb, authUser.id),
          getBandHistory(sb, authUser.id),
        ]);
        setUser(summary);
        setBandHistory(history);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, [router]);

  function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    router.push(`/tutor?q=${encodeURIComponent(chatInput)}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[rgb(var(--primary))] animate-spin" />
      </div>
    );
  }

  const isPro = Boolean(user?.is_pro) || (user?.plan !== undefined && user.plan !== "free" && user?.subscription_status === "active");
  const streak = user?.streak ?? 0;
  const targetBand = user?.target_band ?? 7.0;
  const examDate = user?.exam_date ?? null;
  const daysLeft = daysUntil(examDate);
  const name = user?.name ?? "Студент";
  const examTypeLabel = user?.exam_type === "academic" ? "IELTS Academic"
    : user?.exam_type === "general" ? "IELTS General"
    : "IELTS";

  // Skill bands
  const skillBands = SKILL_META.map((s) => ({
    ...s,
    band: (user?.[`band_${s.key}` as keyof typeof user] as number | null) ?? 0,
  }));

  // Getting Started checklist
  const startedItems = [
    { label: "Зарегистрироваться", done: true },
    { label: "Указать целевой балл", done: (user?.target_band ?? 0) > 0 },
    { label: "Пройти диагностику", done: skillBands.some((s) => s.band > 0) },
    { label: "Пройти первый тест", done: bandHistory.length > 0 },
    { label: "Указать дату экзамена", done: !!examDate },
    { label: "Получить AI фидбек", done: (user?.band_writing ?? 0) > 0 || (user?.band_speaking ?? 0) > 0 },
  ];
  const startedProgress = Math.round((startedItems.filter((i) => i.done).length / startedItems.length) * 100);

  return (
    <AppShell title="Главная">
      <div className="max-w-6xl mx-auto flex flex-col gap-5 animate-fade-in">

        {/* ── Upgrade / limit banner ── */}
        {!isPro && (
          <div className="bg-violet-50/60 border border-violet-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-11 h-11 rounded-xl bg-[rgb(var(--primary))] flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-[rgb(var(--foreground))]">Бесплатный план активен</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">1 тест в день на Free · Pro открывает все тесты без лимита</div>
              </div>
            </div>
            <PaymentChoiceButton className="self-stretch sm:self-auto" />
          </div>
        )}

        {/* ── Tabs row ── */}
        <div className="flex gap-2 overflow-x-auto">
          {[
            { href: "/dashboard", label: "Главная", active: true },
            { href: "/progress",  label: "Прогресс" },
            { href: "/plan",      label: "AI план" },
            { href: "/tutor",     label: "AI тьютор" },
          ].map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
                t.active
                  ? "bg-[rgb(var(--primary))] text-white"
                  : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] hover:bg-white"
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* ── Exam info card ── */}
        <div className="bg-white rounded-2xl border border-[rgb(var(--border))] p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-[rgb(var(--primary))]" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[rgb(var(--foreground))]">{examTypeLabel}</div>
            <div className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
              {examDate ? new Date(examDate).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "Дата экзамена не указана"}
              {daysLeft !== null && examDate && (
                <span className="ml-2 text-[rgb(var(--primary))] font-medium">· {daysLeft} дн.</span>
              )}
            </div>
          </div>

          <div className="bg-[rgb(var(--muted)/0.05)] rounded-xl px-4 py-2.5 flex flex-col gap-1 sm:min-w-[180px]">
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-[rgb(var(--muted-foreground))]" />
              <span className="text-[10px] uppercase tracking-wider text-[rgb(var(--muted-foreground))] font-semibold">Целевой балл</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[rgb(var(--muted-foreground))]">Overall:</span>
              <span className="font-bold text-[rgb(var(--primary))]">{formatBand(targetBand)}</span>
              <PenLine className="w-3.5 h-3.5 text-[rgb(var(--muted-foreground))] ml-auto" />
              <span className="text-xs text-[rgb(var(--muted-foreground))]">—</span>
              <Mic2 className="w-3.5 h-3.5 text-[rgb(var(--muted-foreground))]" />
              <span className="text-xs text-[rgb(var(--muted-foreground))]">—</span>
            </div>
          </div>

          <Link href="/settings" className="p-2 rounded-lg hover:bg-[rgb(var(--muted)/0.08)] transition-colors">
            <Edit3 className="w-4 h-4 text-[rgb(var(--muted-foreground))]" />
          </Link>
        </div>

        {/* ── Skills grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
          {skillBands.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className="group bg-white rounded-2xl border border-[rgb(var(--border))] p-4 hover:border-[rgb(var(--primary)/0.3)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.bg)}>
                  <s.icon className={cn("w-5 h-5", s.color)} strokeWidth={2.25} />
                </div>
                <ChevronRight className="w-4 h-4 text-[rgb(var(--muted-foreground))] group-hover:text-[rgb(var(--primary))] group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="text-sm font-semibold text-[rgb(var(--foreground))]">{s.label}</div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-mono text-2xl font-bold text-[rgb(var(--foreground))]">
                  {s.band > 0 ? formatBand(s.band) : "—"}
                </span>
                {s.band > 0 && (
                  <span className="text-xs text-[rgb(var(--muted-foreground))]">band</span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* ── Band progress chart ── */}
        {bandHistory.length > 0 && (
          <BandLineChart bandHistory={bandHistory} targetBand={targetBand} />
        )}

        {/* ── AI Chatbot section ── */}
        <div className="relative bg-white rounded-2xl border border-[rgb(var(--border))] shadow-sm p-6 md:p-10 flex flex-col items-center text-center overflow-hidden">
          <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 rounded-full bg-violet-100/40 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-blue-100/40 blur-3xl" aria-hidden />
          <div className="relative flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center animate-float">
              <Sparkles className="w-6 h-6 text-[rgb(var(--primary))]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[rgb(var(--foreground))]">
              Привет, {name}!
            </h1>
          </div>
          <p className="text-[rgb(var(--muted-foreground))] mb-6 max-w-md">
            ✨ AI-тьютор поможет с любым вопросом по IELTS — на русском или английском.
          </p>

          <form onSubmit={handleChatSubmit} className="w-full max-w-2xl">
            <div className="relative">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Спроси что угодно на своём языке"
                className="w-full px-5 py-4 pr-14 rounded-2xl border border-[rgb(var(--border))] bg-white text-sm text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--muted-foreground))] focus:outline-none focus:border-[rgb(var(--primary))] focus:ring-2 focus:ring-[rgb(var(--primary)/0.1)] transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[rgb(var(--primary)/0.08)] hover:bg-[rgb(var(--primary))] hover:text-white text-[rgb(var(--primary))] flex items-center justify-center transition-colors"
                aria-label="Отправить"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mt-3 justify-center flex-wrap">
              {[
                { q: "Объясни Task 2 структуру", emoji: "📝" },
                { q: "Как готовиться к Speaking Part 2", emoji: "🎤" },
                { q: "True/False/Not Given правила", emoji: "📖" },
              ].map((s) => (
                <button
                  key={s.q}
                  type="button"
                  onClick={() => setChatInput(s.q)}
                  className="text-xs text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] bg-[rgb(var(--muted)/0.05)] hover:bg-[rgb(var(--muted)/0.1)] px-3 py-1.5 rounded-full transition-colors"
                >
                  {s.emoji} {s.q}
                </button>
              ))}
            </div>
          </form>
        </div>

        {/* ── Bottom row: streak / getting started ── */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Streak */}
          <div className="bg-white rounded-2xl border border-[rgb(var(--border))] p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[rgb(var(--foreground))]">{streak}</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">дней подряд</div>
              </div>
            </div>
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              {streak > 0
                ? `Так держать! Не пропусти сегодня — иначе сбросится.`
                : "Пройди один тест сегодня чтобы начать streak."}
            </p>
          </div>

          {/* Getting started */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-[rgb(var(--border))] p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Star className="w-5 h-5 text-[rgb(var(--primary))]" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-[rgb(var(--foreground))]">Первые шаги</span>
                  <span className="font-bold text-[rgb(var(--primary))]">{startedProgress}%</span>
                </div>
                <div className="h-1.5 bg-[rgb(var(--muted)/0.1)] rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-[rgb(var(--primary))] transition-all duration-500"
                    style={{ width: `${startedProgress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {startedItems.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    item.done
                      ? "text-[rgb(var(--muted-foreground))] line-through"
                      : "text-[rgb(var(--foreground))]"
                  )}
                >
                  <CheckCircle2
                    className={cn(
                      "w-4 h-4 shrink-0",
                      item.done ? "text-[rgb(var(--success))]" : "text-[rgb(var(--muted))]"
                    )}
                  />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
