"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn, formatBand } from "@/lib/utils";
import {
  BookOpen,
  Headphones,
  PenLine,
  Mic2,
  Flame,
  TrendingUp,
  ChevronRight,
  BookMarked,
  Lock,
} from "lucide-react";
import { BandLineChart } from "./band-line-chart";
import type { Database } from "@/lib/supabase/types";

type ContentType = "reading" | "listening" | "writing" | "speaking";
type Attempt = Database["public"]["Tables"]["user_test_attempts"]["Row"];
type BandHistoryRow = Database["public"]["Views"]["v_band_history"]["Row"];
type Summary = Database["public"]["Views"]["v_user_summary"]["Row"];

const SKILL_META: Record<ContentType, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  iconColor: string;
}> = {
  reading:   { label: "Reading",   icon: BookOpen,   color: "text-blue-500",   bg: "bg-blue-50",   iconColor: "text-blue-500" },
  listening: { label: "Listening", icon: Headphones, color: "text-red-400",    bg: "bg-red-50",    iconColor: "text-red-400" },
  writing:   { label: "Writing",   icon: PenLine,    color: "text-green-500",  bg: "bg-green-50",  iconColor: "text-green-500" },
  speaking:  { label: "Speaking",  icon: Mic2,       color: "text-amber-500",  bg: "bg-amber-50",  iconColor: "text-amber-500" },
};

type SkillStat = {
  key: ContentType;
  band: number;
  prev: number;
  attempts: number;
  weakArea: string | null;
};

type Props = {
  summary: Summary | null;
  skills: SkillStat[];
  bandHistory: BandHistoryRow[];
  attempts: Attempt[];
  activity: boolean[];
  streak: number;
  targetBand: number;
};

export function OverviewTab({ summary, skills, bandHistory, attempts, activity, streak, targetBand }: Props) {
  const overallBand = useMemo(() => {
    const filled = skills.filter((s) => s.band > 0);
    if (filled.length === 0) return 0;
    return Math.round((filled.reduce((s, sk) => s + sk.band, 0) / filled.length) * 2) / 2;
  }, [skills]);

  const overallPrev = useMemo(() => {
    const filled = skills.filter((s) => s.band > 0);
    if (filled.length === 0) return 0;
    return Math.round((filled.reduce((s, sk) => s + sk.prev, 0) / filled.length) * 2) / 2;
  }, [skills]);

  const weekActivity = useMemo(() => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const week = activity.slice(-(dayOfWeek + 1));
    while (week.length < 7) week.unshift(false);
    return week;
  }, [activity]);

  const activeDaysThisWeek = weekActivity.filter(Boolean).length;
  const DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  // Heatmap: group activity into weeks (rows = days Mon-Sun, columns = weeks)
  const heatmapData = useMemo(() => {
    const dayMap = new Map<string, number>();
    for (const a of attempts) {
      const d = a.completed_at.slice(0, 10);
      dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
    }

    const weeks: { date: string; count: number }[][] = [];
    const totalDays = activity.length;
    const now = new Date();

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dow = (d.getDay() + 6) % 7;
      const weekIdx = Math.floor((totalDays - 1 - i + ((new Date(now).getDay() + 6) % 7)) / 7);

      if (!weeks[weekIdx]) weeks[weekIdx] = [];
      weeks[weekIdx][dow] = { date: dateStr, count: dayMap.get(dateStr) ?? 0 };
    }

    // Restructure: rows = days (0=Mon..6=Sun), cols = weeks
    const rows: { date: string; count: number }[][] = [];
    for (let d = 0; d < 7; d++) {
      rows[d] = [];
      for (let w = 0; w < weeks.length; w++) {
        rows[d].push(weeks[w]?.[d] ?? { date: "", count: 0 });
      }
    }
    return rows;
  }, [activity, attempts]);

  const bandColor = (b: number) =>
    b >= 7 ? "text-[rgb(var(--band-high))]" : b >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]";

  const delta = overallBand - overallPrev;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Top 3 cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* АКТИВНОСТЬ */}
        <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-widest text-[rgb(var(--muted-foreground))] font-medium mb-3">Активность</div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-bold text-[rgb(var(--foreground))]">{streak}</span>
            <span className="text-sm text-[rgb(var(--muted-foreground))]">дней подряд</span>
          </div>
          <div className="flex items-center gap-1.5 my-3">
            {weekActivity.map((active, i) => (
              <div
                key={i}
                className={cn(
                  "w-3.5 h-3.5 rounded-full",
                  active ? "bg-[rgb(var(--success))]" : "bg-[rgb(var(--surface-elevated))]"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            {DOW.map((d, i) => (
              <span key={i} className="text-[9px] text-[rgb(var(--muted-foreground))] w-3.5 text-center">{d}</span>
            ))}
          </div>
          <p className="text-xs text-[rgb(var(--muted-foreground))] mt-3">{activeDaysThisWeek} из 7 дней на этой неделе</p>
        </div>

        {/* ТЕКУЩИЙ УРОВЕНЬ */}
        <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-widest text-[rgb(var(--muted-foreground))] font-medium mb-3">Текущий уровень</div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className={cn("text-4xl font-bold", overallBand > 0 ? bandColor(overallBand) : "text-[rgb(var(--foreground))]")}>
              {overallBand > 0 ? formatBand(overallBand) : "—"}
            </span>
            {overallPrev > 0 && delta !== 0 && (
              <span className="text-sm text-[rgb(var(--muted-foreground))]">→ {formatBand(overallPrev)}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["reading", "listening", "writing", "speaking"] as ContentType[]).map((sk) => {
              const s = skills.find((s) => s.key === sk);
              const band = s?.band ?? 0;
              return (
                <div key={sk} className="flex items-center justify-between bg-[rgb(var(--background))] rounded-lg px-3 py-2">
                  <span className="text-xs text-[rgb(var(--muted-foreground))] font-medium">{sk.charAt(0).toUpperCase()}</span>
                  <span className={cn("font-mono text-sm font-bold", band > 0 ? bandColor(band) : "text-[rgb(var(--muted))]")}>
                    {band > 0 ? formatBand(band) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ДО ЦЕЛИ */}
        <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-widest text-[rgb(var(--muted-foreground))] font-medium mb-3">До цели</div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-4xl font-bold text-[rgb(var(--primary))]">{formatBand(targetBand)}</span>
            <span className="text-sm text-[rgb(var(--muted-foreground))]">цель</span>
          </div>
          <div className="w-full h-2.5 bg-[rgb(var(--surface-elevated))] rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-[rgb(var(--primary))] rounded-full transition-all"
              style={{ width: `${overallBand > 0 ? Math.min(100, (overallBand / targetBand) * 100) : 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[rgb(var(--muted-foreground))]">{overallBand > 0 ? formatBand(overallBand) : "0.0"} сейчас</span>
            {overallBand > 0 && targetBand > overallBand ? (
              <span className="text-[rgb(var(--destructive))] font-medium">осталось {formatBand(targetBand - overallBand)}</span>
            ) : overallBand >= targetBand ? (
              <span className="text-[rgb(var(--success))] font-medium">цель достигнута!</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── 4 Skill cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {skills.map((sk) => {
          const meta = SKILL_META[sk.key];
          const Icon = meta.icon;
          const delta = sk.band - sk.prev;
          return (
            <Link
              key={sk.key}
              href={`/tests/${sk.key}`}
              className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5 hover:border-[rgb(var(--primary)/0.3)] transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", meta.bg)}>
                    <Icon className={cn("w-5 h-5", meta.iconColor)} />
                  </div>
                  <div>
                    <div className="font-semibold text-[rgb(var(--foreground))]">{meta.label}</div>
                    <div className="text-xs text-[rgb(var(--muted-foreground))]">{sk.attempts} тест{sk.attempts === 1 ? "" : sk.attempts < 5 ? "а" : "ов"}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("font-mono text-2xl font-bold", sk.band > 0 ? bandColor(sk.band) : "text-[rgb(var(--muted))]")}>
                    {sk.band > 0 ? formatBand(sk.band) : "—"}
                  </div>
                  {delta > 0.05 && (
                    <div className="flex items-center gap-0.5 text-xs text-[rgb(var(--success))] justify-end">
                      <TrendingUp className="w-3 h-3" />
                      {formatBand(delta)}
                    </div>
                  )}
                </div>
              </div>
              {sk.weakArea && (
                <p className="text-xs text-[rgb(var(--muted-foreground))]">Слабое место: {sk.weakArea}</p>
              )}
            </Link>
          );
        })}
      </div>

      {/* ── Словарь card ── */}
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5 flex items-center gap-4 opacity-60">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <BookMarked className="w-5 h-5 text-indigo-500" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-[rgb(var(--foreground))]">Словарь</div>
          <div className="text-xs text-[rgb(var(--muted-foreground))]">Скоро — персональный словарь из тестов</div>
        </div>
        <Lock className="w-4 h-4 text-[rgb(var(--muted-foreground))]" />
      </div>

      {/* ── Activity heatmap ── */}
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
        <h3 className="font-semibold text-[rgb(var(--foreground))] mb-4">Активность</h3>
        <div className="flex gap-1">
          <div className="flex flex-col gap-1 mr-1 pt-0">
            {["Пн", "", "Ср", "", "Пт", "", "Вс"].map((d, i) => (
              <div key={i} className="h-3.5 flex items-center">
                <span className="text-[9px] text-[rgb(var(--muted-foreground))] w-5">{d}</span>
              </div>
            ))}
          </div>
          {heatmapData[0]?.map((_, colIdx) => (
            <div key={colIdx} className="flex flex-col gap-1">
              {heatmapData.map((row, rowIdx) => {
                const cell = row[colIdx];
                const intensity = cell?.count ?? 0;
                return (
                  <div
                    key={rowIdx}
                    className={cn(
                      "w-3.5 h-3.5 rounded-sm",
                      intensity === 0 ? "bg-[rgb(var(--surface-elevated))]"
                        : intensity === 1 ? "bg-emerald-200"
                        : intensity === 2 ? "bg-emerald-400"
                        : "bg-emerald-600"
                    )}
                    title={cell?.date ? `${cell.date}: ${cell.count} тест(ов)` : ""}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 mt-3 text-[9px] text-[rgb(var(--muted-foreground))]">
          <span>Меньше</span>
          <div className="w-3 h-3 rounded-sm bg-[rgb(var(--surface-elevated))]" />
          <div className="w-3 h-3 rounded-sm bg-emerald-200" />
          <div className="w-3 h-3 rounded-sm bg-emerald-400" />
          <div className="w-3 h-3 rounded-sm bg-emerald-600" />
          <span>Больше</span>
        </div>
      </div>

      {/* ── Band line chart ── */}
      <BandLineChart bandHistory={bandHistory} targetBand={targetBand} />
    </div>
  );
}
