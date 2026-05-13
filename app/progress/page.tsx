"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, formatBand } from "@/lib/utils";
import {
  ChevronLeft,
  BookOpen,
  Headphones,
  PenLine,
  Mic2,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  Target,
  Calendar,
  BarChart3,
  Loader2,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserSummary, getBandHistory, getUserAttempts } from "@/lib/supabase/queries";
import type { Database } from "@/lib/supabase/types";
import { AppShell } from "@/components/layout/app-shell";

type ContentType = "reading" | "listening" | "writing" | "speaking";
type Attempt = Database["public"]["Tables"]["user_test_attempts"]["Row"];

const SKILL_META: Record<ContentType, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  hasAccuracy: boolean;
}> = {
  reading:   { label: "Reading",   icon: BookOpen,   color: "text-blue-500",   bg: "bg-blue-50",   hasAccuracy: true },
  listening: { label: "Listening", icon: Headphones, color: "text-purple-500", bg: "bg-purple-50", hasAccuracy: true },
  writing:   { label: "Writing",   icon: PenLine,    color: "text-teal-500",   bg: "bg-teal-50",   hasAccuracy: false },
  speaking:  { label: "Speaking",  icon: Mic2,       color: "text-violet-500", bg: "bg-violet-50", hasAccuracy: false },
};

type SkillStat = {
  key: ContentType;
  band: number;            // current band (latest)
  prev: number;            // band ~2 weeks ago
  attempts: number;        // total attempts ever
  accuracy: number | null; // % avg (raw_score / total_questions) for reading/listening
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const [loading, setLoading] = useState(true);
  const [activeSkill, setActiveSkill] = useState<ContentType>("reading");
  const [skills, setSkills] = useState<SkillStat[]>([]);
  const [history, setHistory] = useState<Record<ContentType, (number | null)[]>>({
    reading: [], listening: [], writing: [], speaking: [],
  });
  const [streak, setStreak] = useState(0);
  const [totalAttempts28, setTotalAttempts28] = useState(0);
  const [activity28, setActivity28] = useState<boolean[]>(Array(28).fill(false));
  const [targetBand, setTargetBand] = useState(7.0);
  const [attemptsByContent, setAttemptsByContent] = useState<Record<ContentType, Attempt[]>>({
    reading: [], listening: [], writing: [], speaking: [],
  });

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;

        const [summary, bandHistory, allAttempts] = await Promise.all([
          getUserSummary(sb, user.id),
          getBandHistory(sb, user.id),
          getUserAttempts(sb, user.id, undefined, 500),
        ]);

        if (summary) {
          setStreak(summary.streak ?? 0);
          setTargetBand(summary.target_band ?? 7.0);
        }

        // ── Group attempts by content_type ──
        const byContent: Record<ContentType, Attempt[]> = {
          reading: [], listening: [], writing: [], speaking: [],
        };
        for (const a of (allAttempts as Attempt[])) {
          const ct = a.content_type as ContentType;
          if (ct in byContent) byContent[ct].push(a);
        }
        setAttemptsByContent(byContent);

        // ── Build skills stats ──
        const computedSkills: SkillStat[] = (Object.keys(SKILL_META) as ContentType[]).map((key) => {
          const meta = SKILL_META[key];
          const skillAttempts = byContent[key];

          // Current band: latest non-null
          const currentBand = (summary?.[`band_${key}` as keyof typeof summary] as number | null) ?? null;

          // Previous band: from band_history, ~14+ days ago
          const skillBandHistory = bandHistory.filter((r) => r.content_type === key);
          const cutoff14 = Date.now() - 14 * 24 * 3600 * 1000;
          const before14 = skillBandHistory.filter((r) => new Date(r.attempt_date).getTime() < cutoff14);
          const prevBand = before14.length
            ? before14.reduce((s, r) => s + r.daily_band, 0) / before14.length
            : (currentBand ?? 0);

          // Accuracy: avg raw_score / total_questions, only for skills that track it
          let accuracy: number | null = null;
          if (meta.hasAccuracy) {
            const accurateAttempts = skillAttempts.filter(
              (a) => a.raw_score !== null && a.total_questions && a.total_questions > 0
            );
            if (accurateAttempts.length > 0) {
              const sumPct = accurateAttempts.reduce(
                (s, a) => s + ((a.raw_score ?? 0) / (a.total_questions ?? 1)),
                0
              );
              accuracy = Math.round((sumPct / accurateAttempts.length) * 100);
            }
          }

          return {
            key,
            band: currentBand ?? 0,
            prev: prevBand,
            attempts: skillAttempts.length,
            accuracy,
          };
        });
        setSkills(computedSkills);

        // ── 14-entry history per skill ──
        const newHistory: Record<ContentType, (number | null)[]> = {
          reading: [], listening: [], writing: [], speaking: [],
        };
        for (const key of Object.keys(SKILL_META) as ContentType[]) {
          // Build a map date → band for last 14 days
          const skillHist = bandHistory.filter((r) => r.content_type === key);
          const dateMap = new Map<string, number>();
          for (const r of skillHist) {
            dateMap.set(r.attempt_date.slice(0, 10), r.daily_band);
          }
          const days: (number | null)[] = [];
          for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key2 = d.toISOString().slice(0, 10);
            days.push(dateMap.get(key2) ?? null);
          }
          newHistory[key] = days;
        }
        setHistory(newHistory);

        // ── 28-day activity heatmap ──
        const todayUTC = new Date();
        todayUTC.setUTCHours(0, 0, 0, 0);
        const activeDates = new Set<string>();
        const cutoff28 = todayUTC.getTime() - 27 * 24 * 3600 * 1000;
        let total28 = 0;
        for (const a of (allAttempts as Attempt[])) {
          const ts = new Date(a.completed_at).getTime();
          if (ts >= cutoff28) {
            activeDates.add(new Date(a.completed_at).toISOString().slice(0, 10));
            total28++;
          }
        }
        const activity: boolean[] = [];
        for (let i = 27; i >= 0; i--) {
          const d = new Date(todayUTC);
          d.setUTCDate(d.getUTCDate() - i);
          activity.push(activeDates.has(d.toISOString().slice(0, 10)));
        }
        setActivity28(activity);
        setTotalAttempts28(total28);
      } catch (err) {
        console.error("[progress]", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const skill = skills.find((s) => s.key === activeSkill);

  const filledSkills = skills.filter((s) => s.band > 0);
  const overallBand = filledSkills.length
    ? Math.round((filledSkills.reduce((s, sk) => s + sk.band, 0) / filledSkills.length) * 2) / 2
    : 0;
  const overallPrev = filledSkills.length
    ? Math.round((filledSkills.reduce((s, sk) => s + sk.prev, 0) / filledSkills.length) * 2) / 2
    : 0;
  const overallDelta = overallBand - overallPrev;

  // Reading question type analysis from attempts.ai_feedback (if present)
  const questionTypeStats = useMemo(() => {
    if (activeSkill !== "reading" && activeSkill !== "listening") return [];
    const attempts = attemptsByContent[activeSkill];
    const stats = new Map<string, { correct: number; total: number }>();
    for (const a of attempts) {
      const fb = a.ai_feedback as { by_type?: Record<string, { correct: number; total: number }> } | null;
      if (fb?.by_type) {
        for (const [type, counts] of Object.entries(fb.by_type)) {
          const cur = stats.get(type) ?? { correct: 0, total: 0 };
          cur.correct += counts.correct;
          cur.total += counts.total;
          stats.set(type, cur);
        }
      }
    }
    return Array.from(stats.entries())
      .map(([type, c]) => ({
        type,
        accuracy: Math.round((c.correct / c.total) * 100),
        total: c.total,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [activeSkill, attemptsByContent]);

  if (loading) {
    return (
      <AppShell title="Прогресс">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[rgb(var(--primary))]" />
        </div>
      </AppShell>
    );
  }

  const hasAnyData = filledSkills.length > 0 || totalAttempts28 > 0;

  // Empty state
  if (!hasAnyData) {
    return (
      <AppShell title="Прогресс">
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
              <Link href="/tests/reading">Начать Reading</Link>
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
    <AppShell title="Прогресс">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">

        {/* ── Overview row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex flex-col items-center gap-1 text-center">
              <span className="text-xs text-[rgb(var(--muted-foreground))]">Общий балл</span>
              <span className={cn(
                "font-mono text-4xl font-bold",
                overallBand >= 7 ? "text-[rgb(var(--band-high))]" : overallBand >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]"
              )}>{overallBand > 0 ? formatBand(overallBand) : "—"}</span>
              <div className="flex items-center gap-1 text-xs">
                {overallDelta > 0 ? (
                  <><TrendingUp className="w-3 h-3 text-[rgb(var(--success))]" /><span className="text-[rgb(var(--success))]">+{formatBand(overallDelta)}</span></>
                ) : overallDelta < 0 ? (
                  <><TrendingDown className="w-3 h-3 text-[rgb(var(--destructive))]" /><span className="text-[rgb(var(--destructive))]">{formatBand(overallDelta)}</span></>
                ) : (
                  <><Minus className="w-3 h-3 text-[rgb(var(--muted))]" /><span className="text-[rgb(var(--muted))]">без изменений</span></>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center gap-1 text-center">
              <span className="text-xs text-[rgb(var(--muted-foreground))]">Streak</span>
              <div className="flex items-center gap-1">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="font-bold text-2xl text-[rgb(var(--foreground))]">{streak}</span>
              </div>
              <span className="text-xs text-[rgb(var(--muted-foreground))]">дней подряд</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center gap-1 text-center">
              <span className="text-xs text-[rgb(var(--muted-foreground))]">Тестов</span>
              <span className="font-bold text-2xl text-[rgb(var(--foreground))]">{totalAttempts28}</span>
              <span className="text-xs text-[rgb(var(--muted-foreground))]">за 28 дней</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center gap-1 text-center">
              <span className="text-xs text-[rgb(var(--muted-foreground))]">Цель</span>
              <div className="flex items-center gap-1">
                <Target className="w-4 h-4 text-[rgb(var(--primary))]" />
                <span className="font-bold text-2xl text-[rgb(var(--foreground))]">{formatBand(targetBand)}</span>
              </div>
              <span className="text-xs text-[rgb(var(--muted-foreground))]">
                {overallBand > 0 && targetBand > overallBand
                  ? `+${formatBand(targetBand - overallBand)} до цели`
                  : overallBand >= targetBand ? "цель достигнута!" : "—"}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* ── Skills tabs ── */}
        <div>
          <div className="flex flex-wrap gap-2 mb-5">
            {skills.map((sk) => {
              const meta = SKILL_META[sk.key];
              const delta = sk.band - sk.prev;
              return (
                <button
                  key={sk.key}
                  onClick={() => setActiveSkill(sk.key)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                    activeSkill === sk.key
                      ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.08)] text-[rgb(var(--primary))]"
                      : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.3)]"
                  )}
                >
                  <meta.icon className={cn("w-4 h-4", meta.color)} />
                  {meta.label}
                  {sk.band > 0 ? (
                    <span className={cn(
                      "font-mono text-xs",
                      sk.band >= 7 ? "text-[rgb(var(--band-high))]" : sk.band >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]"
                    )}>{formatBand(sk.band)}</span>
                  ) : (
                    <span className="text-xs text-[rgb(var(--muted))]">—</span>
                  )}
                  {delta > 0.05 && <span className="text-[rgb(var(--success))] text-xs">↑</span>}
                </button>
              );
            })}
          </div>

          {/* Skill detail */}
          {skill && (
            <div className="grid md:grid-cols-3 gap-5">
              {/* Band chart */}
              <Card className="md:col-span-2">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {(() => { const Icon = SKILL_META[skill.key].icon; return <Icon className={cn("w-4 h-4", SKILL_META[skill.key].color)} />; })()}
                      <span className="font-semibold text-[rgb(var(--foreground))]">{SKILL_META[skill.key].label} — последние 14 дней</span>
                    </div>
                    <Badge variant="outline" className="text-xs">14 дней</Badge>
                  </div>

                  {history[skill.key].some((v) => v !== null) ? (
                    <>
                      <div className="flex items-end gap-1 h-32">
                        {history[skill.key].map((v, i) => {
                          if (v === null) {
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div className="flex-1 w-full" />
                                <div className="w-full bg-[rgb(var(--surface-elevated))] rounded-sm" style={{ height: "4px", opacity: 0.3 }} />
                              </div>
                            );
                          }
                          const pct = ((v - 3) / 6) * 100;
                          const isLatest = i === history[skill.key].findLastIndex((x) => x !== null);
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <div className="flex-1 w-full flex items-end">
                                <div
                                  className={cn("w-full rounded-t-sm transition-all", isLatest ? "bg-[rgb(var(--primary))]" : "bg-[rgb(var(--primary)/0.3)]")}
                                  style={{ height: `${Math.max(8, pct)}%` }}
                                />
                              </div>
                              <span className="text-[9px] text-[rgb(var(--muted-foreground))] font-mono">{v}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[10px] text-[rgb(var(--muted-foreground))] mt-2">
                        <span>2 нед. назад</span>
                        <span>Сегодня</span>
                      </div>
                    </>
                  ) : (
                    <div className="h-32 flex items-center justify-center text-sm text-[rgb(var(--muted-foreground))]">
                      Нет данных за 14 дней
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="flex flex-col gap-4">
                <Card>
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-[rgb(var(--foreground))]">Тестов пройдено</span>
                      <span className="font-bold text-[rgb(var(--foreground))]">{skill.attempts}</span>
                    </div>
                    {skill.accuracy !== null && (
                      <div>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-[rgb(var(--muted-foreground))]">Точность</span>
                          <span className={cn(
                            "font-medium",
                            skill.accuracy >= 70 ? "text-[rgb(var(--success))]" : skill.accuracy >= 55 ? "text-[rgb(var(--warning))]" : "text-[rgb(var(--destructive))]"
                          )}>{skill.accuracy}%</span>
                        </div>
                        <Progress value={skill.accuracy}
                          indicatorClassName={skill.accuracy >= 70 ? "bg-[rgb(var(--success))]" : skill.accuracy >= 55 ? "bg-[rgb(var(--band-mid))]" : "bg-[rgb(var(--band-low))]"}
                        />
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[rgb(var(--muted-foreground))]">Рост за 2 нед.</span>
                      <span className={cn(
                        "font-mono font-semibold text-sm",
                        skill.band - skill.prev > 0.05 ? "text-[rgb(var(--success))]" :
                        skill.band - skill.prev < -0.05 ? "text-[rgb(var(--destructive))]" :
                        "text-[rgb(var(--muted-foreground))]"
                      )}>
                        {skill.prev === 0 ? "—" :
                          skill.band - skill.prev > 0.05 ? `+${formatBand(skill.band - skill.prev)}` :
                          skill.band - skill.prev < -0.05 ? formatBand(skill.band - skill.prev) :
                          "стабильно"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Button className="w-full" asChild>
                  <Link href={`/tests/${skill.key}`} className="flex items-center justify-center gap-1.5">
                    Пройти тест <ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Question type breakdown ── */}
        {questionTypeStats.length > 0 && (
          <div>
            <h2 className="font-semibold text-[rgb(var(--foreground))] mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[rgb(var(--primary))]" />
              Точность по типам вопросов — {SKILL_META[activeSkill].label}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {questionTypeStats.map(({ type, accuracy, total }) => {
                const color = accuracy >= 70 ? "bg-[rgb(var(--success))]" : accuracy >= 55 ? "bg-[rgb(var(--band-mid))]" : "bg-[rgb(var(--band-low))]";
                const textColor = accuracy >= 70 ? "text-[rgb(var(--success))]" : accuracy >= 55 ? "text-[rgb(var(--warning))]" : "text-[rgb(var(--destructive))]";
                return (
                  <div key={type} className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-[rgb(var(--foreground))]">{type}</span>
                      <span className={cn("text-sm font-bold font-mono", textColor)}>{accuracy}%</span>
                    </div>
                    <Progress value={accuracy} className="h-1.5 mb-1" indicatorClassName={color} />
                    <span className="text-xs text-[rgb(var(--muted-foreground))]">{total} вопросов</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Activity heatmap ── */}
        <div>
          <h2 className="font-semibold text-[rgb(var(--foreground))] mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[rgb(var(--primary))]" />
            Активность (28 дней)
          </h2>
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5">
            <div className="grid grid-cols-7 gap-2">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                <div key={d} className="text-center text-[10px] text-[rgb(var(--muted-foreground))] font-medium pb-1">{d}</div>
              ))}
              {activity28.map((active, i) => (
                <div
                  key={i}
                  className={cn(
                    "aspect-square rounded-md transition-colors",
                    active ? "bg-[rgb(var(--primary))]" : "bg-[rgb(var(--surface-elevated))]"
                  )}
                  title={active ? "Тест пройден" : "Пропущен"}
                />
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4 text-xs text-[rgb(var(--muted-foreground))]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[rgb(var(--primary))]" />
                Активный
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[rgb(var(--surface-elevated))]" />
                Пропуск
              </div>
              <span className="ml-auto font-medium text-[rgb(var(--foreground))]">
                {activity28.filter(Boolean).length}/28 дней
              </span>
            </div>
          </div>
        </div>

        {/* ── AI tip / CTA ── */}
        {filledSkills.length > 0 && (() => {
          const weakest = [...filledSkills].sort((a, b) => a.band - b.band)[0];
          return (
            <Card className="border-violet-200 bg-gradient-to-br from-violet-50/60 to-blue-50/40">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-violet-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[rgb(var(--foreground))] mb-1">Фокус на {SKILL_META[weakest.key].label}</h3>
                  <p className="text-sm text-[rgb(var(--muted-foreground))] mb-3">
                    Это самый слабый скилл — текущий band {formatBand(weakest.band)}. Подтягивай его в первую очередь —
                    это даст максимальный рост общего балла.
                  </p>
                  <Button size="sm" asChild>
                    <Link href={`/tests/${weakest.key}`}>Пройти {SKILL_META[weakest.key].label} тест</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })()}

      </div>
    </AppShell>
  );
}
