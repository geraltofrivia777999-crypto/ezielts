"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

type ContentType = "reading" | "listening" | "writing" | "speaking";

type BandHistoryRow = {
  content_type: ContentType;
  attempt_date: string;
  daily_band: number;
};

const SKILL_COLORS: Record<ContentType, string> = {
  reading: "#3B82F6",
  listening: "#EF4444",
  writing: "#22C55E",
  speaking: "#F59E0B",
};

const SKILL_LABELS: Record<ContentType, string> = {
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
};

type Props = {
  bandHistory: BandHistoryRow[];
  targetBand: number;
};

export function BandLineChart({ bandHistory, targetBand }: Props) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    date: string;
    skill: string;
    band: number;
    color: string;
  } | null>(null);

  const { dates, skillLines, yMin, yMax } = useMemo(() => {
    const dateSet = new Set<string>();
    for (const r of bandHistory) dateSet.add(r.attempt_date.slice(0, 10));
    const sortedDates = Array.from(dateSet).sort();

    if (sortedDates.length === 0) {
      return { dates: [], skillLines: {}, yMin: 3, yMax: 9 };
    }

    const bySkill: Record<ContentType, Map<string, number>> = {
      reading: new Map(), listening: new Map(), writing: new Map(), speaking: new Map(),
    };
    for (const r of bandHistory) {
      bySkill[r.content_type as ContentType]?.set(r.attempt_date.slice(0, 10), r.daily_band);
    }

    let min = 9, max = 0;
    for (const r of bandHistory) {
      if (r.daily_band < min) min = r.daily_band;
      if (r.daily_band > max) max = r.daily_band;
    }
    // Always include target band so the goal line is visible
    if (targetBand > max) max = targetBand;
    if (targetBand < min) min = targetBand;

    min = Math.max(0, Math.floor(min) - 1);
    max = Math.min(9, Math.ceil(max) + 1);
    // Ensure at least 4-band spread for a readable chart
    if (max - min < 4) {
      const mid = (min + max) / 2;
      min = Math.max(0, Math.floor(mid - 2));
      max = Math.min(9, Math.ceil(mid + 2));
    }

    return { dates: sortedDates, skillLines: bySkill, yMin: min, yMax: max };
  }, [bandHistory, targetBand]);

  if (dates.length === 0) {
    return (
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
        <h3 className="font-semibold text-[rgb(var(--foreground))] mb-4">Динамика баллов</h3>
        <div className="h-48 flex items-center justify-center text-sm text-[rgb(var(--muted-foreground))]">
          Нет данных для отображения
        </div>
      </div>
    );
  }

  const W = 600, H = 300;
  const PAD = { top: 20, right: 45, bottom: 40, left: 35 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  function x(i: number) { return PAD.left + (dates.length === 1 ? plotW / 2 : (i / (dates.length - 1)) * plotW); }
  function y(band: number) { return PAD.top + plotH - ((band - yMin) / (yMax - yMin)) * plotH; }

  const goalY = y(targetBand);
  const skills = (Object.keys(SKILL_COLORS) as ContentType[]).filter(
    (sk) => (skillLines as Record<ContentType, Map<string, number>>)[sk]?.size > 0
  );

  function formatDateLabel(d: string) {
    const dt = new Date(d);
    const day = dt.getDate();
    const months = ["янв.", "фев.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сен.", "окт.", "ноя.", "дек."];
    return `${day} ${months[dt.getMonth()]}`;
  }

  const xLabels: { idx: number; label: string }[] = [];
  if (dates.length <= 6) {
    for (let i = 0; i < dates.length; i++) xLabels.push({ idx: i, label: formatDateLabel(dates[i]) });
  } else {
    const step = Math.max(1, Math.floor(dates.length / 5));
    for (let i = 0; i < dates.length; i += step) xLabels.push({ idx: i, label: formatDateLabel(dates[i]) });
    if (xLabels[xLabels.length - 1].idx !== dates.length - 1) {
      xLabels.push({ idx: dates.length - 1, label: formatDateLabel(dates[dates.length - 1]) });
    }
  }

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax; v++) yTicks.push(v);

  return (
    <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[rgb(var(--foreground))]">Динамика баллов</h3>
        <div className="flex items-center gap-4 flex-wrap">
          {skills.map((sk) => (
            <div key={sk} className="flex items-center gap-1.5 text-xs text-[rgb(var(--muted-foreground))]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SKILL_COLORS[sk] }} />
              {SKILL_LABELS[sk]}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-[rgb(var(--muted-foreground))]">
            <span className="w-4 border-t-2 border-dashed border-red-400" />
            Цель
          </div>
        </div>
      </div>

      <div className="relative" onMouseLeave={() => setTooltip(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          {/* Y-axis grid + labels */}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="rgb(var(--border))" strokeWidth="0.5" strokeDasharray="4 4" />
              <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fill="rgb(var(--muted-foreground))" fontSize="10">{v}</text>
            </g>
          ))}

          {/* Goal line */}
          {targetBand >= yMin && targetBand <= yMax && (
            <>
              <line x1={PAD.left} y1={goalY} x2={W - PAD.right} y2={goalY} stroke="#EF4444" strokeWidth="1.5" strokeDasharray="6 4" />
              <text x={W - PAD.right + 4} y={goalY + 4} fill="#EF4444" fontSize="10" fontWeight="600">Цель</text>
            </>
          )}

          {/* X-axis labels */}
          {xLabels.map(({ idx, label }) => (
            <text key={idx} x={x(idx)} y={H - 8} textAnchor="middle" fill="rgb(var(--muted-foreground))" fontSize="10">{label}</text>
          ))}

          {/* Skill lines */}
          {skills.map((sk) => {
            const map = (skillLines as Record<ContentType, Map<string, number>>)[sk];
            const points: { px: number; py: number; date: string; band: number }[] = [];
            dates.forEach((d, i) => {
              const band = map.get(d);
              if (band !== undefined) points.push({ px: x(i), py: y(band), date: d, band });
            });
            if (points.length === 0) return null;
            const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.px} ${p.py}`).join(" ");
            return (
              <g key={sk}>
                <path d={pathD} fill="none" stroke={SKILL_COLORS[sk]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {points.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.px}
                    cy={p.py}
                    r="4"
                    fill={SKILL_COLORS[sk]}
                    stroke="white"
                    strokeWidth="2"
                    className="cursor-pointer"
                    onMouseEnter={() => setTooltip({ x: p.px, y: p.py, date: p.date, skill: SKILL_LABELS[sk], band: p.band, color: SKILL_COLORS[sk] })}
                  />
                ))}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-white border border-[rgb(var(--border))] rounded-lg shadow-lg px-3 py-2 text-xs z-10"
            style={{
              left: `${(tooltip.x / W) * 100}%`,
              top: `${(tooltip.y / H) * 100}%`,
              transform: "translate(-50%, -120%)",
            }}
          >
            <div className="text-[rgb(var(--muted-foreground))] mb-1">{formatDateLabel(tooltip.date)} {new Date(tooltip.date).getFullYear()}</div>
            <div className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tooltip.color }} />
              {tooltip.skill}: Band {tooltip.band.toFixed(1)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
