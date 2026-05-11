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
