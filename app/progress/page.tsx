"use client";

import { useState, useEffect, useMemo } from "react";
import { cn, formatBand } from "@/lib/utils";
import {
  BookOpen,
  Headphones,
  PenLine,
  Mic2,
  Loader2,
  BarChart3,
  Crown,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getUserSummary, getBandHistory, getUserAttempts } from "@/lib/supabase/queries";
import { canUseProgressTracker } from "@/lib/supabase/access";
import type { Database } from "@/lib/supabase/types";
import { AppShell } from "@/components/layout/app-shell";
import { OverviewTab } from "./_components/overview-tab";
import { SkillTab } from "./_components/skill-tab";

type ContentType = "reading" | "listening" | "writing" | "speaking";
type TabId = "overview" | ContentType | "vocabulary";
type TimePeriod = "week" | "month" | "3months" | "6months" | "all";
type Attempt = Database["public"]["Tables"]["user_test_attempts"]["Row"];
type BandHistoryRow = Database["public"]["Views"]["v_band_history"]["Row"];
type Summary = Database["public"]["Views"]["v_user_summary"]["Row"];

const SKILL_META: Record<ContentType, {
  label: string;
  icon: React.ElementType;
  color: string;
  hasAccuracy: boolean;
}> = {
  reading:   { label: "Reading",   icon: BookOpen,   color: "text-blue-500",   hasAccuracy: true },
  listening: { label: "Listening", icon: Headphones, color: "text-purple-500", hasAccuracy: true },
  writing:   { label: "Writing",   icon: PenLine,    color: "text-teal-500",   hasAccuracy: false },
  speaking:  { label: "Speaking",  icon: Mic2,       color: "text-violet-500", hasAccuracy: false },
};

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "reading", label: "Reading" },
  { id: "listening", label: "Listening" },
  { id: "writing", label: "Writing" },
  { id: "speaking", label: "Speaking" },
  { id: "vocabulary", label: "Словарь" },
];

const PERIODS: { id: TimePeriod; label: string; days: number | null }[] = [
  { id: "week", label: "Неделя", days: 7 },
  { id: "month", label: "Месяц", days: 30 },
  { id: "3months", label: "3 мес", days: 90 },
  { id: "6months", label: "6 мес", days: 180 },
  { id: "all", label: "Всё время", days: null },
];

function ProgressPaywall() {
  return (
    <AppShell title="Статистика">
      <div className="relative mx-auto max-w-6xl">
        <div className="pointer-events-none select-none blur-[5px] opacity-50">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="h-8 w-40 rounded-lg bg-[rgb(var(--surface-elevated))]" />
                <div className="mt-2 h-4 w-72 rounded bg-[rgb(var(--surface-elevated))]" />
              </div>
              <div className="h-10 w-72 rounded-xl bg-[rgb(var(--surface))] border border-[rgb(var(--border))]" />
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {["Reading", "Listening", "Writing", "Speaking"].map((skill, index) => (
                <div key={skill} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="h-5 w-24 rounded bg-[rgb(var(--surface-elevated))]" />
                    <div className="h-8 w-8 rounded-xl bg-[rgb(var(--surface-elevated))]" />
                  </div>
                  <div className="font-mono text-4xl font-bold">{(5.5 + index * 0.5).toFixed(1)}</div>
                  <div className="mt-4 h-2 rounded-full bg-[rgb(var(--surface-elevated))]" />
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="h-80 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
                <div className="mb-6 h-5 w-36 rounded bg-[rgb(var(--surface-elevated))]" />
                <div className="flex h-56 items-end gap-3">
                  {[40, 58, 52, 70, 66, 78, 84, 74, 88, 92].map((height, index) => (
                    <div key={index} className="flex-1 rounded-t-lg bg-[rgb(var(--primary)/0.35)]" style={{ height: `${height}%` }} />
                  ))}
                </div>
              </div>
              <div className="h-80 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
                <div className="mb-6 h-5 w-32 rounded bg-[rgb(var(--surface-elevated))]" />
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 28 }).map((_, index) => (
                    <div key={index} className="aspect-square rounded-md bg-[rgb(var(--success)/0.35)]" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-0 flex items-start justify-center px-4 pt-20 sm:items-center sm:pt-0">
          <div className="w-full max-w-lg rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--primary))]">
              <Lock className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-[rgb(var(--foreground))]">Прогресс доступен по подписке</h1>
            <p className="mt-2 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
              Прогресс-трекер доступен с тарифа 3 месяца. Обновите подписку, чтобы видеть графики,
              историю попыток, слабые места и динамику по каждому навыку.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="flex-1">
                <Link href="/pricing">
                  <Crown className="h-4 w-4" />
                  Купить подписку
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/tests">К тестам</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function filterByPeriod<T extends { completed_at?: string; attempt_date?: string }>(items: T[], period: TimePeriod): T[] {
  const p = PERIODS.find((pp) => pp.id === period);
  if (!p?.days) return items;
  const cutoff = Date.now() - p.days * 24 * 3600 * 1000;
  return items.filter((item) => {
    const dateStr = (item as Record<string, unknown>).completed_at ?? (item as Record<string, unknown>).attempt_date;
    return typeof dateStr === "string" && new Date(dateStr).getTime() >= cutoff;
  });
}

export default function ProgressPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [period, setPeriod] = useState<TimePeriod>("month");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [allAttempts, setAllAttempts] = useState<Attempt[]>([]);
  const [allBandHistory, setAllBandHistory] = useState<BandHistoryRow[]>([]);
  const [nowTs, setNowTs] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;

        const [sum, history, attempts] = await Promise.all([
          getUserSummary(sb, user.id),
          getBandHistory(sb, user.id),
          getUserAttempts(sb, user.id, undefined, 1000),
        ]);

        if (sum) setSummary(sum);
        setAllBandHistory(history);
        setAllAttempts(attempts);
      } catch (err) {
        console.error("[progress]", err);
      } finally {
        setNowTs(Date.now());
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filter data by selected period
  const attempts = useMemo(() => filterByPeriod(allAttempts, period), [allAttempts, period]);
  const bandHistory = useMemo(() => {
    const p = PERIODS.find((pp) => pp.id === period);
    if (!p?.days) return allBandHistory;
    const cutoff = nowTs - p.days * 24 * 3600 * 1000;
    return allBandHistory.filter((r) => new Date(r.attempt_date).getTime() >= cutoff);
  }, [allBandHistory, nowTs, period]);

  // Group attempts by skill
  const attemptsBySkill = useMemo(() => {
    const bySkill: Record<ContentType, Attempt[]> = { reading: [], listening: [], writing: [], speaking: [] };
    for (const a of attempts) {
      const ct = a.content_type as ContentType;
      if (ct in bySkill) bySkill[ct].push(a);
    }
    return bySkill;
  }, [attempts]);

  // Compute skill stats for overview
  const skills = useMemo(() => {
    return (Object.keys(SKILL_META) as ContentType[]).map((key) => {
      const currentBand = (summary?.[`band_${key}` as keyof Summary] as number | null) ?? 0;
      const skillHistory = allBandHistory.filter((r) => r.content_type === key);
      const cutoff14 = nowTs - 14 * 24 * 3600 * 1000;
      const before14 = skillHistory.filter((r) => new Date(r.attempt_date).getTime() < cutoff14);
      const prevBand = before14.length
        ? before14.reduce((s, r) => s + r.daily_band, 0) / before14.length
        : currentBand;

      const skillAttempts = attemptsBySkill[key];

      // Find weakest area
      let weakArea: string | null = null;
      if (key === "reading" || key === "listening") {
        const fb = skillAttempts.find((a) => a.ai_feedback && (a.ai_feedback as { by_type?: unknown }).by_type);
        if (fb) {
          const byType = (fb.ai_feedback as { by_type: Record<string, { correct: number; total: number }> }).by_type;
          let worstType = "", worstAcc = 101;
          for (const [type, counts] of Object.entries(byType)) {
            const acc = counts.total > 0 ? (counts.correct / counts.total) * 100 : 100;
            if (acc < worstAcc) { worstAcc = acc; worstType = type; }
          }
          if (worstType) weakArea = `${worstType} (${Math.round(worstAcc)}%)`;
        }
      } else if (key === "writing" || key === "speaking") {
        const fb = skillAttempts.find((a) => a.ai_feedback && (a.ai_feedback as { criteria?: unknown }).criteria);
        if (fb) {
          const criteria = (fb.ai_feedback as { criteria: Record<string, { band: number }> }).criteria;
          let worstKey = "", worstBand = 10;
          for (const [k, v] of Object.entries(criteria)) {
            if (v.band < worstBand) { worstBand = v.band; worstKey = k; }
          }
          const labels: Record<string, string> = {
            task_achievement: "Task Achievement", coherence_cohesion: "Coherence & Cohesion",
            lexical_resource: "Lexical Resource", grammatical_range: "Grammatical Range",
            fluency_coherence: "Fluency & Coherence", pronunciation: "Pronunciation",
          };
          if (worstKey) weakArea = `${labels[worstKey] ?? worstKey} (${formatBand(worstBand)})`;
        }
      }

      return {
        key,
        band: currentBand,
        prev: prevBand,
        attempts: skillAttempts.length,
        weakArea,
      };
    });
  }, [summary, allBandHistory, attemptsBySkill, nowTs]);

  // Activity array (28 days)
  const activity28 = useMemo(() => {
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    const activeDates = new Set<string>();
    const cutoff28 = todayUTC.getTime() - 27 * 24 * 3600 * 1000;
    for (const a of allAttempts) {
      if (new Date(a.completed_at).getTime() >= cutoff28) {
        activeDates.add(new Date(a.completed_at).toISOString().slice(0, 10));
      }
    }
    const activity: boolean[] = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date(todayUTC);
      d.setUTCDate(d.getUTCDate() - i);
      activity.push(activeDates.has(d.toISOString().slice(0, 10)));
    }
    return activity;
  }, [allAttempts]);

  const streak = summary?.streak ?? 0;
  const targetBand = summary?.target_band ?? 7.0;
  const hasProgressAccess = canUseProgressTracker(summary);

  if (loading) {
    return (
      <AppShell title="Статистика">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[rgb(var(--primary))]" />
        </div>
      </AppShell>
    );
  }

  if (!hasProgressAccess) {
    return <ProgressPaywall />;
  }

  const hasAnyData = allAttempts.length > 0;

  if (!hasAnyData) {
    return (
      <AppShell title="Статистика">
        <div className="max-w-3xl mx-auto py-16 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-[rgb(var(--primary)/0.08)] flex items-center justify-center mb-5">
            <BarChart3 className="w-10 h-10 text-[rgb(var(--primary))]" />
          </div>
          <h1 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-2">
            Прогресс появится после первых тестов
          </h1>
          <p className="text-[rgb(var(--muted-foreground))] mb-8 max-w-md mx-auto">
            Пройди хотя бы один Reading или Listening тест — сразу увидишь свой текущий уровень, точность и динамику.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
            <Button asChild className="flex-1">
              <Link href="/tests?skill=reading">Начать Reading</Link>
            </Button>
            <Button variant="outline" asChild className="flex-1">
              <Link href="/diagnostic">Пройти диагностику</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Статистика">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[rgb(var(--foreground))]">Статистика</h1>
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Отслеживайте свой прогресс по навыкам</p>
          </div>
          {/* Period selector */}
          <div className="flex items-center bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-lg p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  period === p.id
                    ? "bg-[rgb(var(--background))] text-[rgb(var(--foreground))] shadow-sm"
                    : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab navigation ── */}
        <nav className="flex border-b border-[rgb(var(--border))] overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative",
                activeTab === tab.id
                  ? "text-[rgb(var(--foreground))]"
                  : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[rgb(var(--foreground))] rounded-t" />
              )}
            </button>
          ))}
        </nav>

        {/* ── Tab content ── */}
        {activeTab === "overview" && (
          <OverviewTab
            summary={summary}
            skills={skills}
            bandHistory={bandHistory}
            attempts={attempts}
            activity={activity28}
            streak={streak}
            targetBand={targetBand}
          />
        )}

        {(activeTab === "reading" || activeTab === "listening" || activeTab === "writing" || activeTab === "speaking") && (
          <SkillTab
            skill={activeTab}
            attempts={attemptsBySkill[activeTab]}
            bandHistory={bandHistory}
            currentBand={skills.find((s) => s.key === activeTab)?.band ?? 0}
            prevBand={skills.find((s) => s.key === activeTab)?.prev ?? 0}
            targetBand={targetBand}
          />
        )}

        {activeTab === "vocabulary" && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-[rgb(var(--foreground))] mb-2">Словарь скоро появится</h2>
            <p className="text-sm text-[rgb(var(--muted-foreground))] max-w-sm mx-auto">
              Персональный словарь из тестов с отслеживанием прогресса запоминания.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
