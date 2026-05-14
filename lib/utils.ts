import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a band score (e.g. 6.5) for display */
export function formatBand(score: number): string {
  return score % 1 === 0 ? `${score}.0` : `${score}`;
}

/** Return Tailwind color class based on band score */
export function bandColor(score: number): string {
  if (score >= 7) return "text-band-high";
  if (score >= 5) return "text-band-mid";
  return "text-band-low";
}

/** Format seconds → mm:ss */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Convert raw correct-answer count to official IELTS Academic Reading/Listening band.
 * Scores normalized to a 40-question test. For shorter practice tests
 * (e.g. 13 or 20 questions), pass `totalQuestions` to scale proportionally.
 * Returns a band in [0, 9] rounded to nearest 0.5.
 *
 * Reference: Cambridge IELTS Academic conversion table.
 */
export function rawToBand(rawCorrect: number, totalQuestions: number = 40): number {
  if (totalQuestions <= 0) return 0;
  const safeRaw = Math.max(0, Math.min(rawCorrect, totalQuestions));
  // Scale to /40
  const scaled = Math.round((safeRaw / totalQuestions) * 40);

  // Official Academic Reading band table (Listening uses the same scale ±0.5 per tier)
  const table: Array<[number, number]> = [
    [39, 9.0],
    [37, 8.5],
    [35, 8.0],
    [33, 7.5],
    [30, 7.0],
    [27, 6.5],
    [23, 6.0],
    [19, 5.5],
    [15, 5.0],
    [13, 4.5],
    [10, 4.0],
    [8, 3.5],
    [6, 3.0],
    [4, 2.5],
    [3, 2.0],
    [2, 1.5],
    [1, 1.0],
  ];
  for (const [threshold, band] of table) {
    if (scaled >= threshold) return band;
  }
  return 0;
}

/** Clamp & round any number to a valid IELTS band: [0, 9] in 0.5 steps. */
export function clampBand(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const clamped = Math.max(0, Math.min(9, n));
  return Math.round(clamped * 2) / 2;
}
