"use client";

import { useMemo, useState } from "react";
import { cn, formatBand } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock, FileQuestion, ChevronDown, TrendingUp } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type ContentType = "reading" | "listening" | "writing" | "speaking";
type Attempt = Database["public"]["Tables"]["user_test_attempts"]["Row"];
type BandHistoryRow = Database["public"]["Views"]["v_band_history"]["Row"];

const READING_SECTIONS = [
  { section: 1, label: "Section 1", range: "Q1-13", start: 0, end: 13 },
  { section: 2, label: "Section 2", range: "Q14-26", start: 13, end: 26 },
  { section: 3, label: "Section 3", range: "Q27-40", start: 26, end: 40 },
];

const LISTENING_SECTIONS = [
  { section: 1, label: "Section 1", range: "Q1-10", start: 0, end: 10 },
  { section: 2, label: "Section 2", range: "Q11-20", start: 10, end: 20 },
  { section: 3, label: "Section 3", range: "Q21-30", start: 20, end: 30 },
  { section: 4, label: "Section 4", range: "Q31-40", start: 30, end: 40 },
];

const WRITING_CRITERIA = [
  { key: "task_achievement", label: "Task Achievement", code: "TA" },
  { key: "coherence_cohesion", label: "Coherence & Cohesion", code: "CC" },
  { key: "lexical_resource", label: "Lexical Resource", code: "LR" },
  { key: "grammatical_range", label: "Grammatical Range & Accuracy", code: "GRA" },
];

const SPEAKING_CRITERIA = [
  { key: "fluency_coherence", label: "Fluency & Coherence", code: "FC" },
  { key: "lexical_resource", label: "Lexical Resource", code: "LR" },
  { key: "grammatical_range", label: "Grammatical Range & Accuracy", code: "GRA" },
  { key: "pronunciation", label: "Pronunciation", code: "PR" },
];

type Props = {
  skill: ContentType;
  attempts: Attempt[];
  bandHistory: BandHistoryRow[];
  currentBand: number;
  prevBand: number;
  targetBand: number;
};

type SectionStat = {
  label: string;
  range: string;
  correct: number;
  total: number;
  accuracy: number;
  prevAccuracy: number | null;
};

export function SkillTab({ skill, attempts, bandHistory, currentBand, prevBand, targetBand }: Props) {
  const [showDetails, setShowDetails] = useState(true);

  const sortedAttempts = useMemo(
    () => [...attempts].sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()),
    [attempts],
  );

  // Section-level stats (Reading/Listening) — compare recent half vs older half for ПРОГРЕСС
  const sectionStats = useMemo((): SectionStat[] => {
    if (skill !== "reading" && skill !== "listening") return [];

    const sections = skill === "reading" ? READING_SECTIONS : LISTENING_SECTIONS;

    const mid = Math.floor(sortedAttempts.length / 2);
    const recentAttempts = mid > 0 ? sortedAttempts.slice(0, mid) : sortedAttempts;
    const olderAttempts = mid > 0 ? sortedAttempts.slice(mid) : [];

    function computeSection(attemptsSlice: Attempt[]) {
      const stats: Record<number, { correct: number; total: number }> = {};
      for (const sec of sections) stats[sec.section] = { correct: 0, total: 0 };
      for (const a of attemptsSlice) {
        const fb = a.ai_feedback as { by_section?: Record<string, { correct: number; total: number }> } | null;
        if (fb?.by_section) {
          for (const [secKey, counts] of Object.entries(fb.by_section)) {
            const secNum = parseInt(secKey);
            if (stats[secNum]) {
              stats[secNum].correct += counts.correct;
              stats[secNum].total += counts.total;
            }
          }
        }
      }
      return stats;
    }

    const allStats = computeSection(sortedAttempts);
    const recentStats = computeSection(recentAttempts);
    const olderStats = olderAttempts.length > 0 ? computeSection(olderAttempts) : null;

    return sections.map((sec) => {
      const s = allStats[sec.section];
      const accuracy = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;

      let prevAccuracy: number | null = null;
      if (olderStats) {
        const o = olderStats[sec.section];
        if (o.total > 0) {
          prevAccuracy = Math.round((o.correct / o.total) * 100);
        }
      }

      return {
        label: `${sec.label} (${sec.range})`,
        range: sec.range,
        correct: s.correct,
        total: s.total,
        accuracy,
        prevAccuracy,
      };
    });
  }, [skill, sortedAttempts]);

  // Question type stats
  const questionTypeStats = useMemo(() => {
    if (skill !== "reading" && skill !== "listening") return [];
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
        correct: c.correct,
        total: c.total,
        accuracy: Math.round((c.correct / c.total) * 100),
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [skill, attempts]);

  // Writing/Speaking criteria averages + prev comparison
  const criteriaStats = useMemo(() => {
    if (skill !== "writing" && skill !== "speaking") return [];
    const criteriaKeys = skill === "writing" ? WRITING_CRITERIA : SPEAKING_CRITERIA;

    function computeCriteria(attemptsSlice: Attempt[]) {
      const sums: Record<string, { total: number; count: number }> = {};
      for (const c of criteriaKeys) sums[c.key] = { total: 0, count: 0 };
      for (const a of attemptsSlice) {
        const fb = a.ai_feedback as { criteria?: Record<string, { band: number }> } | null;
        if (fb?.criteria) {
          for (const c of criteriaKeys) {
            const val = fb.criteria[c.key];
            if (val && typeof val.band === "number") {
              sums[c.key].total += val.band;
              sums[c.key].count++;
            }
          }
        }
      }
      return sums;
    }

    const mid = Math.floor(sortedAttempts.length / 2);
    const allSums = computeCriteria(sortedAttempts);
    const olderSums = mid > 0 ? computeCriteria(sortedAttempts.slice(mid)) : null;

    return criteriaKeys.map((c) => {
      const avgBand = allSums[c.key].count > 0
        ? Math.round((allSums[c.key].total / allSums[c.key].count) * 2) / 2
        : null;
      let prevBand: number | null = null;
      if (olderSums && olderSums[c.key].count > 0) {
        prevBand = Math.round((olderSums[c.key].total / olderSums[c.key].count) * 2) / 2;
      }
      return { ...c, avgBand, prevBand };
    });
  }, [skill, sortedAttempts]);

  // Time stats
  const timeStats = useMemo(() => {
    const withTime = attempts.filter((a) => a.time_spent && a.time_spent > 0);
    const avgTime = withTime.length > 0
      ? Math.round(withTime.reduce((s, a) => s + (a.time_spent ?? 0), 0) / withTime.length)
      : null;

    const withAnswers = attempts.filter((a) => a.total_questions && a.total_questions > 0);
    let avgUnanswered: number | null = null;
    if (withAnswers.length > 0) {
      const totalUnanswered = withAnswers.reduce((s, a) => {
        const answered = a.answers ? Object.keys(a.answers as Record<string, unknown>).length : 0;
        return s + ((a.total_questions ?? 0) - answered);
      }, 0);
      avgUnanswered = Math.round((totalUnanswered / withAnswers.length) * 10) / 10;
    }

    return { avgTime, avgUnanswered };
  }, [attempts]);

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const hasData = attempts.length > 0;

  // Mini band trend
  const trendData = useMemo(() => {
    const skillHistory = bandHistory.filter((r) => r.content_type === skill);
    return skillHistory
      .map((r) => ({ date: r.attempt_date, band: r.daily_band }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [bandHistory, skill]);

  if (!hasData) {
    return (
      <div className="text-center py-16 text-sm text-[rgb(var(--muted-foreground))]">
        Нет данных. Пройди тест, чтобы увидеть аналитику.
      </div>
    );
  }

  const accColor = (pct: number) =>
    pct >= 70 ? "text-[rgb(var(--success))]" : pct >= 50 ? "text-[rgb(var(--warning))]" : "text-[rgb(var(--destructive))]";
  const accBarColor = (pct: number) =>
    pct >= 70 ? "bg-[rgb(var(--success))]" : pct >= 50 ? "bg-[rgb(var(--band-mid))]" : "bg-[rgb(var(--band-low))]";
  const bandColor = (b: number) =>
    b >= 7 ? "text-[rgb(var(--band-high))]" : b >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]";
  const bandBarColor = (b: number) =>
    b >= 7 ? "bg-[rgb(var(--band-high))]" : b >= 5.5 ? "bg-[rgb(var(--band-mid))]" : "bg-[rgb(var(--band-low))]";

  return (
    <div className="flex flex-col gap-6">
      {/* ── Section insight cards (Reading/Listening) ── */}
      {(skill === "reading" || skill === "listening") && sectionStats.some((s) => s.total > 0) && (
        <div className="flex flex-col gap-3">
          {sectionStats.filter((s) => s.total > 0).map((sec) => {
            const isCritical = sec.accuracy < 50;
            const delta = sec.prevAccuracy !== null ? sec.accuracy - sec.prevAccuracy : null;
            const isProgress = delta !== null && delta > 5;
            return (
              <div
                key={sec.label}
                className={cn(
                  "border rounded-2xl p-5 flex items-center justify-between",
                  isCritical
                    ? "border-l-4 border-l-[rgb(var(--destructive))] border-[rgb(var(--border))] bg-red-50/30"
                    : isProgress
                    ? "border-l-4 border-l-[rgb(var(--success))] border-[rgb(var(--border))] bg-green-50/30"
                    : "border-l-4 border-l-[rgb(var(--success))] border-[rgb(var(--border))]"
                )}
              >
                <div>
                  <Badge
                    variant="default"
                    className={cn(
                      "mb-2 text-[10px] uppercase tracking-wider",
                      isCritical
                        ? "bg-[rgb(var(--destructive))] hover:bg-[rgb(var(--destructive))]"
                        : isProgress
                        ? "bg-[rgb(var(--success))] hover:bg-[rgb(var(--success))]"
                        : "bg-[rgb(var(--success))] hover:bg-[rgb(var(--success))]"
                    )}
                  >
                    {isCritical ? "Критично" : isProgress ? "Прогресс" : "Норма"}
                  </Badge>
                  <div className="font-semibold text-[rgb(var(--foreground))]">
                    Секция {sec.label.match(/\d+/)?.[0]}: {isProgress && delta !== null ? `+${delta}%` : `${sec.accuracy}%`}
                  </div>
                  <p className="text-sm text-[rgb(var(--muted-foreground))] mt-0.5">
                    {isCritical
                      ? "Точность ниже 50%. Сосредоточься на повторении этой секции."
                      : isProgress
                      ? "Заметный прогресс в этой секции!"
                      : "Хороший уровень. Продолжай в том же духе."}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className={cn("text-2xl font-bold", accColor(sec.accuracy))}>{sec.accuracy}%</div>
                  {isProgress && delta !== null ? (
                    <div className="text-xs text-[rgb(var(--success))] flex items-center justify-end gap-0.5">
                      <TrendingUp className="w-3 h-3" /> {delta}%
                    </div>
                  ) : (
                    <div className="text-xs text-[rgb(var(--muted-foreground))]">цель: 70%</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Criteria insight cards (Writing/Speaking) ── */}
      {(skill === "writing" || skill === "speaking") && criteriaStats.some((c) => c.avgBand !== null) && (
        <div className="flex flex-col gap-3">
          {criteriaStats.filter((c) => c.avgBand !== null).map((c) => {
            const band = c.avgBand!;
            const isCritical = band < 6;
            const delta = c.prevBand !== null ? band - c.prevBand : null;
            const isProgress = delta !== null && delta > 0;
            return (
              <div
                key={c.key}
                className={cn(
                  "border rounded-2xl p-5 flex items-center justify-between",
                  isCritical
                    ? "border-l-4 border-l-[rgb(var(--destructive))] border-[rgb(var(--border))] bg-red-50/30"
                    : isProgress
                    ? "border-l-4 border-l-[rgb(var(--success))] border-[rgb(var(--border))] bg-green-50/30"
                    : "border-l-4 border-l-[rgb(var(--success))] border-[rgb(var(--border))]"
                )}
              >
                <div>
                  <Badge
                    variant="default"
                    className={cn(
                      "mb-2 text-[10px] uppercase tracking-wider",
                      isCritical
                        ? "bg-[rgb(var(--destructive))] hover:bg-[rgb(var(--destructive))]"
                        : isProgress
                        ? "bg-[rgb(var(--success))] hover:bg-[rgb(var(--success))]"
                        : "bg-[rgb(var(--success))] hover:bg-[rgb(var(--success))]"
                    )}
                  >
                    {isCritical ? "Критично" : isProgress ? "Прогресс" : "Норма"}
                  </Badge>
                  <div className="font-semibold text-[rgb(var(--foreground))]">
                    {c.label}: {formatBand(band)}
                  </div>
                  <p className="text-sm text-[rgb(var(--muted-foreground))] mt-0.5">
                    {isCritical
                      ? `Средний балл ${formatBand(band)}. Требует внимания.`
                      : isProgress
                      ? `Заметный прогресс! Было ${formatBand(c.prevBand!)}, стало ${formatBand(band)}.`
                      : `Хороший уровень — ${formatBand(band)}.`}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className={cn("text-2xl font-bold", bandColor(band))}>{formatBand(band)}</div>
                  {isProgress && delta !== null ? (
                    <div className="text-xs text-[rgb(var(--success))] flex items-center justify-end gap-0.5">
                      <TrendingUp className="w-3 h-3" /> +{formatBand(delta)}
                    </div>
                  ) : (
                    <div className="text-xs text-[rgb(var(--muted-foreground))]">цель: {formatBand(targetBand)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Детальная аналитика divider ── */}
      <div className="relative flex items-center">
        <div className="flex-1 h-px bg-[rgb(var(--border))]" />
        <button
          onClick={() => setShowDetails((v) => !v)}
          className="px-4 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-colors flex items-center gap-1"
        >
          Детальная аналитика
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showDetails && "rotate-180")} />
        </button>
        <div className="flex-1 h-px bg-[rgb(var(--border))]" />
      </div>

      {showDetails && (
        <>
          {/* ── Band trend ── */}
          {trendData.length > 1 && (
            <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
              <h3 className="font-semibold text-[rgb(var(--foreground))] mb-4">Тренд баллов</h3>
              <MiniTrendChart data={trendData} targetBand={targetBand} />
            </div>
          )}

          {/* ── Accuracy by sections (Reading/Listening) ── */}
          {(skill === "reading" || skill === "listening") && sectionStats.some((s) => s.total > 0) && (
            <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
              <h3 className="font-semibold text-[rgb(var(--foreground))] mb-4">Accuracy по секциям</h3>
              <div className="flex flex-col gap-4">
                {sectionStats.filter((s) => s.total > 0).map((sec) => (
                  <div key={sec.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-[rgb(var(--foreground))]">{sec.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[rgb(var(--muted-foreground))]">{sec.correct}/{sec.total}</span>
                        <span className={cn("text-sm font-bold font-mono", accColor(sec.accuracy))}>{sec.accuracy}%</span>
                      </div>
                    </div>
                    <Progress value={sec.accuracy} className="h-1.5" indicatorClassName={accBarColor(sec.accuracy)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Criteria breakdown (Writing/Speaking) ── */}
          {(skill === "writing" || skill === "speaking") && criteriaStats.some((c) => c.avgBand !== null) && (
            <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
              <h3 className="font-semibold text-[rgb(var(--foreground))] mb-4">Баллы по критериям</h3>
              <div className="flex flex-col gap-4">
                {criteriaStats.filter((c) => c.avgBand !== null).map((c) => {
                  const band = c.avgBand!;
                  const pct = Math.round((band / 9) * 100);
                  return (
                    <div key={c.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-[rgb(var(--foreground))]">{c.code} — {c.label}</span>
                        <span className={cn("text-sm font-bold font-mono", bandColor(band))}>{formatBand(band)}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" indicatorClassName={bandBarColor(band)} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Question types (Reading/Listening) ── */}
          {questionTypeStats.length > 0 && (
            <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
              <h3 className="font-semibold text-[rgb(var(--foreground))] mb-4">Типы вопросов</h3>
              <div className="flex flex-col gap-3">
                {questionTypeStats.map(({ type, correct, total, accuracy }) => (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[rgb(var(--foreground))]">{type}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[rgb(var(--muted-foreground))]">{correct}/{total}</span>
                        <span className={cn("text-sm font-bold font-mono", accColor(accuracy))}>{accuracy}%</span>
                      </div>
                    </div>
                    <Progress value={accuracy} className="h-1.5" indicatorClassName={accBarColor(accuracy)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Time and completion ── */}
          {(timeStats.avgTime !== null || timeStats.avgUnanswered !== null) && (
            <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
              <h3 className="font-semibold text-[rgb(var(--foreground))] mb-4">Время и completion</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[rgb(var(--background))] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted-foreground))] mb-2">
                    <Clock className="w-3.5 h-3.5" />
                    Среднее время
                  </div>
                  <div className="text-2xl font-bold text-[rgb(var(--foreground))] font-mono">
                    {timeStats.avgTime !== null ? mmss(timeStats.avgTime) : "—:—"}
                  </div>
                  <div className="text-xs text-[rgb(var(--muted-foreground))] mt-1">на тест</div>
                </div>
                <div className="bg-[rgb(var(--background))] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted-foreground))] mb-2">
                    <FileQuestion className="w-3.5 h-3.5" />
                    Без ответа
                  </div>
                  <div className="text-2xl font-bold text-[rgb(var(--foreground))] font-mono">
                    {timeStats.avgUnanswered !== null ? timeStats.avgUnanswered.toFixed(1) : "—"}
                  </div>
                  <div className="text-xs text-[rgb(var(--muted-foreground))] mt-1">вопросов / тест</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Mini trend chart ──
function MiniTrendChart({ data, targetBand }: { data: { date: string; band: number }[]; targetBand: number }) {
  if (data.length < 2) return null;

  const W = 500, H = 180;
  const PAD = { top: 15, right: 40, bottom: 25, left: 30 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  let yMin = Math.min(...data.map((d) => d.band), targetBand);
  let yMax = Math.max(...data.map((d) => d.band), targetBand);
  yMin = Math.max(0, Math.floor(yMin) - 1);
  yMax = Math.min(9, Math.ceil(yMax) + 1);
  if (yMax - yMin < 4) {
    const mid = (yMin + yMax) / 2;
    yMin = Math.max(0, Math.floor(mid - 2));
    yMax = Math.min(9, Math.ceil(mid + 2));
  }

  const xScale = (i: number) => PAD.left + (i / (data.length - 1)) * plotW;
  const yScale = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.band)}`).join(" ");

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax; v++) yTicks.push(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)} stroke="rgb(var(--border))" strokeWidth="0.5" strokeDasharray="3 3" />
          <text x={PAD.left - 6} y={yScale(v) + 3} textAnchor="end" fill="rgb(var(--muted-foreground))" fontSize="9">{v}</text>
        </g>
      ))}
      {targetBand >= yMin && targetBand <= yMax && (
        <>
          <line x1={PAD.left} y1={yScale(targetBand)} x2={W - PAD.right} y2={yScale(targetBand)} stroke="#EF4444" strokeWidth="1" strokeDasharray="5 3" />
          <text x={W - PAD.right + 4} y={yScale(targetBand) + 3} fill="#EF4444" fontSize="9">Цель</text>
        </>
      )}
      <path d={pathD} fill="none" stroke="rgb(var(--primary))" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(d.band)} r="3" fill="rgb(var(--primary))" stroke="white" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
