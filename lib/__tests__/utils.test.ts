import { describe, it, expect } from "vitest";
import { cn, formatBand, bandColor, formatTime, rawToBand, clampBand } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toContain("px-2");
    expect(cn("px-2", "py-1")).toContain("py-1");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden")).toBe("base");
    expect(cn("base", true && "shown")).toBe("base shown");
  });

  it("handles undefined/null gracefully", () => {
    expect(cn("base", undefined, null)).toBe("base");
  });
});

describe("formatBand", () => {
  it("formats whole numbers with .0 suffix", () => {
    expect(formatBand(6)).toBe("6.0");
    expect(formatBand(9)).toBe("9.0");
    expect(formatBand(0)).toBe("0.0");
  });

  it("preserves decimal scores", () => {
    expect(formatBand(6.5)).toBe("6.5");
    expect(formatBand(7.5)).toBe("7.5");
  });
});

describe("bandColor", () => {
  it("returns high for scores >= 7", () => {
    expect(bandColor(7)).toBe("text-band-high");
    expect(bandColor(8.5)).toBe("text-band-high");
    expect(bandColor(9)).toBe("text-band-high");
  });

  it("returns mid for scores 5..6.9", () => {
    expect(bandColor(5)).toBe("text-band-mid");
    expect(bandColor(6)).toBe("text-band-mid");
    expect(bandColor(6.9)).toBe("text-band-mid");
  });

  it("returns low for scores < 5", () => {
    expect(bandColor(4.9)).toBe("text-band-low");
    expect(bandColor(0)).toBe("text-band-low");
  });
});

describe("formatTime", () => {
  it("formats zero", () => {
    expect(formatTime(0)).toBe("00:00");
  });

  it("formats seconds-only values with mm padding", () => {
    expect(formatTime(45)).toBe("00:45");
  });

  it("formats minutes + seconds", () => {
    expect(formatTime(125)).toBe("02:05");
  });

  it("formats exact minute", () => {
    expect(formatTime(60)).toBe("01:00");
  });

  it("handles large values", () => {
    expect(formatTime(3600)).toBe("60:00");
  });
});

describe("rawToBand (IELTS conversion table)", () => {
  it("returns 9.0 for perfect 40/40", () => {
    expect(rawToBand(40, 40)).toBe(9.0);
  });

  it("matches the official Reading table at key thresholds", () => {
    // From the standard IELTS Academic conversion table
    expect(rawToBand(39, 40)).toBe(9.0);
    expect(rawToBand(37, 40)).toBe(8.5);
    expect(rawToBand(35, 40)).toBe(8.0);
    expect(rawToBand(33, 40)).toBe(7.5);
    expect(rawToBand(30, 40)).toBe(7.0);
    expect(rawToBand(27, 40)).toBe(6.5);
    expect(rawToBand(23, 40)).toBe(6.0);
    expect(rawToBand(19, 40)).toBe(5.5);
    expect(rawToBand(15, 40)).toBe(5.0);
    expect(rawToBand(13, 40)).toBe(4.5);
  });

  it("scales correctly for shorter practice tests", () => {
    // 7/13 ≈ 21.5/40 → falls in 19..22 → band 5.5
    expect(rawToBand(7, 13)).toBe(5.5);
    // 13/13 → 40/40 → 9.0
    expect(rawToBand(13, 13)).toBe(9.0);
    // 0/13 → 0
    expect(rawToBand(0, 13)).toBe(0);
  });

  it("clamps out-of-range inputs", () => {
    expect(rawToBand(50, 40)).toBe(9.0); // over-max
    expect(rawToBand(-5, 40)).toBe(0);   // negative
    expect(rawToBand(5, 0)).toBe(0);     // zero total guard
  });
});

describe("clampBand", () => {
  it("rounds to nearest 0.5 step", () => {
    expect(clampBand(6.3)).toBe(6.5);
    expect(clampBand(6.2)).toBe(6.0);
    expect(clampBand(7.749)).toBe(7.5);
    expect(clampBand(7.75)).toBe(8.0);
  });

  it("clamps to [0, 9]", () => {
    expect(clampBand(9.5)).toBe(9);
    expect(clampBand(99)).toBe(9);
    expect(clampBand(-3)).toBe(0);
  });

  it("treats non-numeric / NaN inputs as 0", () => {
    expect(clampBand(undefined)).toBe(0);
    expect(clampBand(null)).toBe(0);
    expect(clampBand("7" as unknown)).toBe(0);
    expect(clampBand(NaN)).toBe(0);
  });
});
