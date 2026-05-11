"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserSummary, getBandHistory, getUserAttempts } from "@/lib/supabase/queries";
import type { Database } from "@/lib/supabase/types";

type ContentType = Database["public"]["Tables"]["user_test_attempts"]["Row"]["content_type"];

// ─── Mock data (used as fallback) ────────────────────────────────────────────

const SKILLS = [
  { key: "reading", label: "Reading", icon: BookOpen, color: "text-blue-500", bg: "bg-blue-50", band: 5.5, prev: 5.0, attempts: 14, accuracy: 68 },
  { key: "listening", label: "Listening", icon: Headphones, color: "text-purple-500", bg: "bg-purple-50", band: 6.0, prev: 5.5, attempts: 10, accuracy: 74 },
  { key: "writing", label: "Writing", icon: PenLine, color: "text-teal-500", bg: "bg-teal-50", band: 5.0, prev: 5.0, attempts: 4, accuracy: null },
  { key: "speaking", label: "Speaking", icon: Mic2, color: "text-violet-500", bg: "bg-violet-50", band: 5.5, prev: 5.0, attempts: 3, accuracy: null },
];

// 4-week band history per skill
const HISTORY = {
  reading:   [4.5, 4.5, 5.0, 5.0, 5.0, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 6.0, 5.5, 6.0],
  listening: [5.0, 5.0, 5.0, 5.5, 5.5, 5.5, 5.5, 5.5, 6.0, 6.0, 6.0, 6.0, 6.0, 6.5],
  writing:   [null, null, null, null, null, null, null, null, 5.0, null, null, null, 5.0, null],
  speaking:  [null, null, null, null, null, null, null, null, null, 5.0, null, null, 5.5, null],
};

// Weak question types (reading heatmap)
const QUESTION_TYPES = [
  { type: "True/False/NG", accuracy: 52, total: 48 },
  { type: "Matching Headings", accuracy: 45, total: 32 },
  { type: "MCQ", accuracy: 74, total: 56 },
  { type: "Summary Completion", accuracy: 61, total: 24 },
  { type: "Short Answer", accuracy: 80, total: 20 },
  { type: "Sentence Completion", accuracy: 69, total: 18 },
];

// 28-day activity heatmap (1=done, 0=missed)
const ACTIVITY = [1,1,0,1,1,1,0, 1,1,1,0,1,1,1, 0,1,1,1,1,0,1, 1,1,0,1,1,1,1];

// ─── Mini sparkline ───────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: (number | null)[]; color: string }) {
  const values = data.filter((v) => v !== null) as number[];
  if (values.length < 2) return <div className="h-8 flex items-center text-xs text-[rgb(var(--muted))]">—</div>;
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const range = max - min || 1;
  const w = 80;
  const h = 32;
  const step = w / (data.length - 1);

  const points = data
    .map((v, i) => v !== null ? `${i * step},${h - ((v - min) / range) * h}` : null)
    .filter(Boolean) as string[];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((pt, i) => {
        const [x, y] = pt.split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r="2" fill={color} />;
      })}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const [activeSkill, setActiveSkill] = useState("reading");
  const [skills, setSkills] = useState(SKILLS);
  const [history, setHistory] = useState<typeof HISTORY>(HISTORY);
  const [streak, setStreak] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);

  // Load real data from Supabase
  useEffect(() => {
    async function load() {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;

        const [summary, bandHistory, attempts] = await Promise.all([
          getUserSummary(sb, user.id),
          getBandHistory(sb, user.id),
          getUserAttempts(sb, user.id, undefined, 100),
        ]);

        if (summary) {
          setStreak(summary.streak ?? 0);
          // Update skill bands from profile
          setSkills((prev) => prev.map((s) => {
            const bandKey = `band_${s.key}` as keyof typeof summary;
            const band = (summary[bandKey] as number | null) ?? s.band;
            return { ...s, band, prev: Math.max(s.band - 0.5, 0) };
          }));
        }

        if (bandHistory.length > 0) {
          // Build 14-entry history per skill from real band history
          const newHistory: typeof HISTORY = { reading: [], listening: [], writing: [], speaking: [] };
          (["reading", "listening", "writing", "speaking"] as ContentType[]).forEach((ct) => {
            const rows = bandHistory.filter((r) => r.content_type === ct).slice(-14);
            newHistory[ct] = Array(14).fill(null).map((_, i) => rows[i]?.daily_band ?? null);
          });
          setHistory(newHistory as typeof HISTORY);
        }

        setTotalAttempts(attempts.length);

        // Count per-skill attempts from real data
        const countBySkill: Record<string, number> = { reading: 0, listening: 0, writing: 0, speaking: 0 };
        attempts.forEach((a) => {
          const ct = a.content_type as string;
          if (ct in countBySkill) countBySkill[ct]++;
        });
        setSkills((prev) => prev.map((s) => ({
          ...s,
          attempts: countBySkill[s.key] ?? s.attempts,
        })));
      } catch { /* use fallback */ }
    }
    load();
  }, []);

  const skill = skills.find((s) => s.key === activeSkill)!;

  const filledSkills = skills.filter((s) => s.band > 0);
  const overallBand = filledSkills.length
    ? Math.round((filledSkills.reduce((s, sk) => s + sk.band, 0) / filledSkills.length) * 2) / 2
    : 0;
  const overallPrev = filledSkills.length
    ? Math.round((filledSkills.reduce((s, sk) => s + sk.prev, 0) / filledSkills.length) * 2) / 2
    : 0;
  const overallDelta = overallBand - overallPrev;

  return (
    <div className="min-h-screen bg-[rgb(var(--background))]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
            <ChevronLeft className="w-4 h-4" />Dashboard
          </Link>
          <div className="flex items-center gap-2 ml-2">
            <BarChart3 className="w-4 h-4 text-[rgb(var(--primary))]" />
            <span className="font-semibold text-[rgb(var(--foreground))]">Прогресс</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* ── Overview row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="md:col-span-1">
            <CardContent className="p-4 flex flex-col items-center gap-1 text-center">
              <span className="text-xs text-[rgb(var(--muted-foreground))]">Общий балл</span>
              <span className={cn(
                "font-mono text-4xl font-bold",
                overallBand >= 7 ? "text-[rgb(var(--band-high))]" : overallBand >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]"
              )}>{formatBand(overallBand)}</span>
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
              <span className="text-xs text-[rgb(var(--muted-foreground))]">Тестов пройдено</span>
              <span className="font-bold text-2xl text-[rgb(var(--foreground))]">{totalAttempts}</span>
              <span className="text-xs text-[rgb(var(--muted-foreground))]">за 4 недели</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center gap-1 text-center">
              <span className="text-xs text-[rgb(var(--muted-foreground))]">Цель</span>
              <div className="flex items-center gap-1">
                <Target className="w-4 h-4 text-[rgb(var(--primary))]" />
                <span className="font-bold text-2xl text-[rgb(var(--foreground))]">7.0</span>
              </div>
              <span className="text-xs text-[rgb(var(--muted-foreground))]">+{formatBand(7.0 - overallBand)} до цели</span>
            </CardContent>
          </Card>
        </div>

        {/* ── Skills tabs ── */}
        <div>
          <div className="flex flex-wrap gap-2 mb-5">
            {SKILLS.map((sk) => {
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
                  <sk.icon className={cn("w-4 h-4", sk.color)} />
                  {sk.label}
                  <span className={cn(
                    "font-mono text-xs",
                    sk.band >= 7 ? "text-[rgb(var(--band-high))]" : sk.band >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]"
                  )}>{formatBand(sk.band)}</span>
                  {delta > 0 && <span className="text-[rgb(var(--success))] text-xs">↑</span>}
                </button>
              );
            })}
          </div>

          {/* Skill detail */}
          <div className="grid md:grid-cols-3 gap-5">
            {/* Band chart */}
            <Card className="md:col-span-2">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <skill.icon className={cn("w-4 h-4", skill.color)} />
                    <span className="font-semibold text-[rgb(var(--foreground))]">{skill.label} — динамика band</span>
                  </div>
                  <Badge variant="outline" className="text-xs">4 недели</Badge>
                </div>

                {/* Chart */}
                <div className="flex items-end gap-1 h-32">
                  {(history[skill.key as keyof typeof history] as (number | null)[]).map((v, i) => {
                    if (v === null) {
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="flex-1 w-full" />
                          <div className="w-full bg-[rgb(var(--surface-elevated))] rounded-sm" style={{ height: "4px", opacity: 0.3 }} />
                        </div>
                      );
                    }
                    const pct = ((v - 3) / 6) * 100;
                    const isLatest = i === (history[skill.key as keyof typeof history] as (number | null)[]).findLastIndex((x) => x !== null);
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
                  <span>4 нед. назад</span>
                  <span>Сейчас</span>
                </div>
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
                    <span className="text-sm text-[rgb(var(--muted-foreground))]">Рост за 4 нед.</span>
                    <span className={cn(
                      "font-mono font-semibold text-sm",
                      skill.band > skill.prev ? "text-[rgb(var(--success))]" : "text-[rgb(var(--muted-foreground))]"
                    )}>
                      {skill.band > skill.prev ? `+${formatBand(skill.band - skill.prev)}` : "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Button className="w-full" asChild>
                <Link href={`/tests/${skill.key}`}>Пройти тест →</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* ── Question type heatmap (Reading) ── */}
        {activeSkill === "reading" && (
          <div>
            <h2 className="font-semibold text-[rgb(var(--foreground))] mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[rgb(var(--primary))]" />
              Слабые типы вопросов
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {QUESTION_TYPES.sort((a, b) => a.accuracy - b.accuracy).map(({ type, accuracy, total }) => {
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
              {ACTIVITY.map((active, i) => (
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
                Активный день
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[rgb(var(--surface-elevated))]" />
                Пропущено
              </div>
              <span className="ml-auto font-medium text-[rgb(var(--foreground))]">
                {ACTIVITY.filter(Boolean).length}/28 дней
              </span>
            </div>
          </div>
        </div>

        {/* ── All skills sparklines ── */}
        <div>
          <h2 className="font-semibold text-[rgb(var(--foreground))] mb-4">Все навыки — обзор</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {SKILLS.map((sk) => {
              const delta = sk.band - sk.prev;
              const sparkColor = sk.band >= 7 ? "#10B981" : sk.band >= 5.5 ? "#F59E0B" : "#EF4444";
              return (
                <Card key={sk.key}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", sk.bg)}>
                      <sk.icon className={cn("w-5 h-5", sk.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[rgb(var(--foreground))]">{sk.label}</span>
                        <div className="flex items-center gap-1.5">
                          {delta > 0 ? <TrendingUp className="w-3 h-3 text-[rgb(var(--success))]" /> : delta < 0 ? <TrendingDown className="w-3 h-3 text-[rgb(var(--destructive))]" /> : <Minus className="w-3 h-3 text-[rgb(var(--muted))]" />}
                          <span className={cn(
                            "font-mono text-lg font-bold",
                            sk.band >= 7 ? "text-[rgb(var(--band-high))]" : sk.band >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]"
                          )}>{formatBand(sk.band)}</span>
                        </div>
                      </div>
                      <Sparkline data={history[sk.key as keyof typeof history] as (number | null)[]} color={sparkColor} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
