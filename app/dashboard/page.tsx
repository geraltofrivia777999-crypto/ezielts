"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, formatBand } from "@/lib/utils";
import {
  BookOpen, Headphones, PenLine, Mic2, Flame, TrendingUp,
  Target, Clock, Lock, ChevronRight, CheckCircle2, BarChart3,
  Zap, Star, Settings, Menu, X, Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserSummary, getBandHistory } from "@/lib/supabase/queries";
import type { Database } from "@/lib/supabase/types";

type UserSummary = Database["public"]["Views"]["v_user_summary"]["Row"];
type BandHistoryRow = Database["public"]["Views"]["v_band_history"]["Row"];

// ─── Days until exam ──────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ─── Task config ──────────────────────────────────────────────────────────────

function buildTasks(isPro: boolean) {
  return [
    { id: "t1", type: "reading", label: "Reading Test", sublabel: "Academic · ~20 мин", icon: BookOpen, color: "text-blue-500", bg: "bg-blue-50", locked: false, href: "/tests/reading" },
    { id: "t2", type: "listening", label: "Listening Test", sublabel: "Section · ~15 мин", icon: Headphones, color: "text-purple-500", bg: "bg-purple-50", locked: false, href: "/tests/listening" },
    { id: "t3", type: "writing", label: "Writing Task 2", sublabel: "AI Feedback · ~40 мин", icon: PenLine, color: "text-teal-500", bg: "bg-teal-50", locked: !isPro, href: "/tests/writing" },
    { id: "t4", type: "speaking", label: "Speaking Practice", sublabel: "Cue Card · ~15 мин", icon: Mic2, color: "text-violet-500", bg: "bg-violet-50", locked: !isPro, href: "/tests/speaking" },
  ];
}

// ─── Paywall Banner ───────────────────────────────────────────────────────────

function PaywallBanner({ readingBand }: { readingBand: number }) {
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgb(var(--primary)) 0%, rgb(var(--secondary)) 100%)" }}>
      <div aria-hidden className="absolute right-0 top-0 w-48 h-48 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, white 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />
      <div className="relative">
        <Badge className="bg-white/20 text-white border-0 mb-3">День 7 🎉</Badge>
        <h3 className="font-bold text-white text-lg mb-1">
          Reading {readingBand > 4 ? (readingBand - 0.5).toFixed(1) : "—"} → {readingBand.toFixed(1)} за неделю!
        </h3>
        <p className="text-white/80 text-sm mb-4">
          Хочешь достичь 7.0? Открой AI Writing + Speaking Coach и персональный план.
        </p>
        <Button className="bg-white text-[rgb(var(--primary))] hover:bg-white/90 font-semibold" size="sm" asChild>
          <Link href="/pricing">Попробовать Pro — от $4/мес <ChevronRight className="w-4 h-4" /></Link>
        </Button>
      </div>
    </div>
  );
}

// ─── Mini Band Chart ──────────────────────────────────────────────────────────

function BandChart({ data }: { data: { day: string; band: number }[] }) {
  const min = 4.0; const max = 8.0; const range = max - min; const height = 80;
  return (
    <div className="flex items-end gap-1.5 h-20 w-full">
      {data.map(({ day, band }, i) => {
        const pct = ((band - min) / range) * 100;
        const barH = Math.max(4, Math.round((pct / 100) * height));
        const isLast = i === data.length - 1;
        return (
          <div key={day + i} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex-1 w-full flex items-end">
              <div className={cn("w-full rounded-t-sm transition-all", isLast ? "bg-[rgb(var(--primary))]" : "bg-[rgb(var(--primary)/0.25)]")}
                style={{ height: `${barH}px` }} />
            </div>
            <span className="text-[10px] text-[rgb(var(--muted-foreground))]">{day}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [navOpen, setNavOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserSummary | null>(null);
  const [bandHistory, setBandHistory] = useState<BandHistoryRow[]>([]);
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

  // ── Derived data ──

  // Pro = either is_pro flag is true OR plan is not free
  // (defends against view computing is_pro incorrectly)
  const isPro = Boolean(user?.is_pro) || (user?.plan !== undefined && user.plan !== "free" && user?.subscription_status === "active");
  const streak = user?.streak ?? 0;
  const targetBand = user?.target_band ?? 7.0;
  const examDate = user?.exam_date ?? null;
  const daysLeft = daysUntil(examDate);
  const name = user?.name ?? "Студент";

  // Skill bands from profile
  const skillBands = [
    { skill: "Reading", band: user?.band_reading ?? 0, icon: BookOpen, color: "text-blue-500" },
    { skill: "Listening", band: user?.band_listening ?? 0, icon: Headphones, color: "text-purple-500" },
    { skill: "Writing", band: user?.band_writing ?? 0, icon: PenLine, color: "text-teal-500" },
    { skill: "Speaking", band: user?.band_speaking ?? 0, icon: Mic2, color: "text-violet-500" },
  ];

  const filledBands = skillBands.filter((s) => s.band > 0);
  const overallBand = filledBands.length
    ? Math.round((filledBands.reduce((s, b) => s + b.band, 0) / filledBands.length) * 2) / 2
    : user?.current_band ?? 0;

  // Build 7-day band chart from reading history
  const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const readingHistory = bandHistory.filter((r) => r.content_type === "reading").slice(-7);
  const chartData = readingHistory.length >= 2
    ? readingHistory.map((r, i) => ({ day: DAYS[i % 7], band: r.daily_band }))
    : DAYS.map((day, i) => ({ day, band: Math.max(4.0, (overallBand || 5.0) - 0.5 + (i * 0.1)) }));

  const tasks = buildTasks(isPro);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[rgb(var(--primary))] animate-spin mx-auto mb-3" />
          <p className="text-sm text-[rgb(var(--muted-foreground))]">Загружаем данные...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col">
      {/* ── Top navbar ── */}
      <header className="sticky top-0 z-40 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
              <span className="text-white font-bold text-xs">EZ</span>
            </div>
            <span className="font-semibold text-[rgb(var(--foreground))] hidden sm:block">ielts</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-4">
            {[
              { href: "/dashboard", label: "Dashboard", active: true },
              { href: "/progress", label: "Прогресс", active: false },
              { href: "/tutor", label: "AI Тьютор", active: false },
              { href: "/pricing", label: "Тарифы", active: false },
            ].map(({ href, label, active }) => (
              <Link key={href} href={href} className={cn(
                "px-3 py-1.5 rounded-lg text-sm transition-colors",
                active ? "bg-[rgb(var(--primary)/0.08)] text-[rgb(var(--primary))] font-medium"
                  : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] hover:bg-[rgb(var(--surface-elevated))]"
              )}>{label}</Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-orange-500">
              <Flame className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{streak}</span>
            </div>
            {!isPro && (
              <Button size="sm" asChild className="hidden sm:flex">
                <Link href="/pricing"><Zap className="w-3.5 h-3.5" />Upgrade</Link>
              </Button>
            )}
            <button className="w-8 h-8 rounded-full bg-[rgb(var(--primary))] flex items-center justify-center text-white text-xs font-bold">
              {name[0]?.toUpperCase() ?? "?"}
            </button>
            <button className="md:hidden p-1" onClick={() => setNavOpen((v) => !v)}>
              {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {navOpen && (
          <div className="md:hidden border-t border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3 flex flex-col gap-1">
            {[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/progress", label: "Прогресс" },
              { href: "/tutor", label: "AI Тьютор" },
              { href: "/pricing", label: "⚡ Upgrade to Pro" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                className="px-3 py-2.5 rounded-lg text-sm text-[rgb(var(--foreground))] hover:bg-[rgb(var(--surface-elevated))]"
                onClick={() => setNavOpen(false)}>
                {label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 flex flex-col gap-6">

        {/* Greeting */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[rgb(var(--foreground))]">
              Привет, {name.split(" ")[0]}! 👋
            </h1>
            <p className="text-[rgb(var(--muted-foreground))] text-sm mt-0.5">
              Продолжай — ты на правильном пути.
            </p>
          </div>
          {daysLeft !== null && (
            <div className="flex items-center gap-2 bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-4 py-2.5">
              <Clock className="w-4 h-4 text-[rgb(var(--warning))]" />
              <div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">До экзамена</div>
                <div className="text-sm font-bold text-[rgb(var(--foreground))]">{daysLeft} дней</div>
              </div>
            </div>
          )}
        </div>

        {/* Day 7 Paywall Banner */}
        {!isPro && streak >= 7 && <PaywallBanner readingBand={user?.band_reading ?? 5.0} />}

        {/* 2-column grid */}
        <div className="grid md:grid-cols-3 gap-6">

          {/* Left — tasks + skills */}
          <div className="md:col-span-2 flex flex-col gap-6">

            {/* Today's tasks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-[rgb(var(--foreground))]">Задачи на сегодня</h2>
              </div>
              <div className="flex flex-col gap-3">
                {tasks.map((task) => {
                  const Icon = task.icon;
                  return (
                    <div key={task.id} className={cn(
                      "bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl p-4 flex items-center gap-4 transition-all",
                      task.locked ? "opacity-60" : "hover:shadow-sm hover:-translate-y-px"
                    )}>
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", task.bg)}>
                        <Icon className={cn("w-5 h-5", task.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-[rgb(var(--foreground))]">{task.label}</span>
                          {task.locked && (
                            <Badge variant="outline" className="text-[10px] gap-1 py-0">
                              <Lock className="w-2.5 h-2.5" /> Pro
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-[rgb(var(--muted-foreground))]">{task.sublabel}</div>
                      </div>
                      {task.locked ? (
                        <Button size="sm" variant="outline" asChild><Link href="/pricing">Открыть</Link></Button>
                      ) : (
                        <Button size="sm" asChild><Link href={task.href}>Начать</Link></Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Skills breakdown */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-[rgb(var(--foreground))]">Уровень по навыкам</h2>
                <Link href="/progress" className="text-xs text-[rgb(var(--primary))] hover:underline flex items-center gap-1">
                  Подробнее <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {skillBands.map(({ skill, band, icon: Icon, color }) => {
                  const bandColorClass = band >= 7 ? "text-[rgb(var(--band-high))]"
                    : band >= 5.5 ? "text-[rgb(var(--band-mid))]"
                    : "text-[rgb(var(--band-low))]";
                  return (
                    <div key={skill} className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn("w-4 h-4", color)} />
                          <span className="text-xs font-medium text-[rgb(var(--foreground))]">{skill}</span>
                        </div>
                        {band > 0 && <TrendingUp className="w-3.5 h-3.5 text-[rgb(var(--success))]" />}
                      </div>
                      <div className={cn("font-mono text-2xl font-bold", band > 0 ? bandColorClass : "text-[rgb(var(--muted-foreground))]")}>
                        {band > 0 ? formatBand(band) : "—"}
                      </div>
                      {band > 0 && (
                        <Progress value={((band - 1) / 8) * 100} className="mt-2 h-1"
                          indicatorClassName={band >= 7 ? "bg-[rgb(var(--band-high))]" : band >= 5.5 ? "bg-[rgb(var(--band-mid))]" : "bg-[rgb(var(--band-low))]"} />
                      )}
                      {band === 0 && (
                        <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">Нет данных</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right — stats + chart */}
          <div className="flex flex-col gap-4">

            {/* Overall band */}
            <Card>
              <CardContent className="p-5 flex flex-col items-center text-center gap-2">
                <div className="text-xs text-[rgb(var(--muted-foreground))] font-medium uppercase tracking-wide">Расчётный балл</div>
                <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-inner"
                  style={{
                    background: overallBand >= 7 ? "rgb(var(--band-high)/0.15)" : overallBand >= 5.5 ? "rgb(var(--band-mid)/0.15)" : "rgb(var(--band-low)/0.15)",
                    border: `3px solid ${overallBand >= 7 ? "rgb(var(--band-high))" : overallBand >= 5.5 ? "rgb(var(--band-mid))" : "rgb(var(--band-low))"}`,
                  }}>
                  <span className={cn("font-mono text-2xl font-bold",
                    overallBand >= 7 ? "text-[rgb(var(--band-high))]" : overallBand >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]")}>
                    {overallBand > 0 ? formatBand(overallBand) : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-[rgb(var(--muted-foreground))]">
                  <Target className="w-3 h-3" />Цель: {formatBand(targetBand)}
                </div>
                {overallBand > 0 && (
                  <>
                    <Progress value={((overallBand - 1) / (targetBand - 1)) * 100} className="w-full h-1.5 mt-1" />
                    <div className="text-xs text-[rgb(var(--muted-foreground))]">
                      {formatBand(Math.max(0, targetBand - overallBand))} балла до цели
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Streak */}
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <div className="text-xs text-[rgb(var(--muted-foreground))]">Streak</div>
                  <div className="font-bold text-[rgb(var(--foreground))]">
                    {streak > 0 ? `${streak} дней подряд 🔥` : "Начни сегодня!"}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Band chart */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-1.5 mb-3">
                  <BarChart3 className="w-4 h-4 text-[rgb(var(--primary))]" />
                  <span className="text-sm font-medium text-[rgb(var(--foreground))]">Reading (7 дней)</span>
                </div>
                {readingHistory.length >= 2 ? (
                  <BandChart data={chartData} />
                ) : (
                  <div className="h-20 flex items-center justify-center text-xs text-[rgb(var(--muted-foreground))]">
                    Пройди первые тесты для графика
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick links */}
            <div className="flex flex-col gap-2">
              {[
                { icon: Star, label: "Персональный план", href: "/plan", locked: !isPro },
                { icon: Settings, label: "Настройки", href: "/settings", locked: false },
              ].map(({ icon: Icon, label, href, locked }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[rgb(var(--surface))] border border-[rgb(var(--border))] hover:shadow-sm transition-all text-sm text-[rgb(var(--foreground))]">
                  <Icon className="w-4 h-4 text-[rgb(var(--muted-foreground))]" />
                  {label}
                  {locked ? <Lock className="w-3.5 h-3.5 text-[rgb(var(--muted))] ml-auto" /> : <ChevronRight className="w-4 h-4 text-[rgb(var(--muted))] ml-auto" />}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
