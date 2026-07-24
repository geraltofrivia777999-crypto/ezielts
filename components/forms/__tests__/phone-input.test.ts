import { describe, it, expect } from "vitest";
import {
  getPhoneCountry,
  extractNationalDigits,
  formatPhoneNational,
  normalizePhoneNumber,
  getPhoneValidationError,
  isValidPhoneNumber,
  PHONE_COUNTRIES,
} from "../phone-input";

describe("phone-input utility functions", () => {
  it("retrieves country by ISO code or defaults to KZ", () => {
    expect(getPhoneCountry("KZ").name).toBe("Казахстан");
    expect(getPhoneCountry("RU").name).toBe("Россия");
    expect(getPhoneCountry("UZ").name).toBe("Узбекистан");
    expect(getPhoneCountry("UNKNOWN").iso).toBe("KZ");
  });

  it("extracts national digits and strips dial code if pasted", () => {
    const kz = getPhoneCountry("KZ");
    expect(extractNationalDigits("+77012345678", kz)).toBe("7012345678");
    expect(extractNationalDigits("7012345678", kz)).toBe("7012345678");
    expect(extractNationalDigits("701 234 56 78", kz)).toBe("7012345678");

    const uz = getPhoneCountry("UZ");
    expect(extractNationalDigits("+998901234567", uz)).toBe("901234567");
  });

  it("formats national phone numbers according to country grouping", () => {
    const kz = getPhoneCountry("KZ");
    expect(formatPhoneNational("7012345678", kz)).toBe("701 234 56 78");

    const uz = getPhoneCountry("UZ");
    expect(formatPhoneNational("901234567", uz)).toBe("90 123 45 67");

    const kg = getPhoneCountry("KG");
    expect(formatPhoneNational("700123456", kg)).toBe("700 123 456");
  });

  it("normalizes phone numbers to international format", () => {
    const kz = getPhoneCountry("KZ");
    expect(normalizePhoneNumber(kz, "701 234 56 78")).toBe("+77012345678");

    const tr = getPhoneCountry("TR");
    expect(normalizePhoneNumber(tr, "501 234 56 78")).toBe("+905012345678");
  });

  it("validates Kazakhstan (KZ) phone numbers correctly", () => {
    const kz = getPhoneCountry("KZ");
    expect(isValidPhoneNumber(kz, "7012345678")).toBe(true);
    expect(isValidPhoneNumber(kz, "7771234567")).toBe(true);

    // Too short
    expect(getPhoneValidationError(kz, "7012345")).toContain("10 цифр");
    // Invalid prefix
    expect(getPhoneValidationError(kz, "0012345678")).toContain("Казахстана");
  });

  it("validates Russia (RU) phone numbers correctly", () => {
    const ru = getPhoneCountry("RU");
    expect(isValidPhoneNumber(ru, "9123456789")).toBe(true);

    // Invalid prefix for mobile/city
    expect(getPhoneValidationError(ru, "1123456789")).toContain("России");
  });

  it("validates Uzbekistan (UZ) phone numbers correctly", () => {
    const uz = getPhoneCountry("UZ");
    expect(isValidPhoneNumber(uz, "901234567")).toBe(true);

    // Too short
    expect(getPhoneValidationError(uz, "9012345")).toContain("9 цифр");
  });

  it("validates Turkey (TR) phone numbers correctly", () => {
    const tr = getPhoneCountry("TR");
    expect(isValidPhoneNumber(tr, "5012345678")).toBe(true);

    // Invalid mobile prefix
    expect(getPhoneValidationError(tr, "2012345678")).toContain("Турции");
  });

  it("validates USA (US) phone numbers correctly", () => {
    const us = getPhoneCountry("US");
    expect(isValidPhoneNumber(us, "5551234567")).toBe(true);

    // Cannot start with 0 or 1
    expect(getPhoneValidationError(us, "0551234567")).toContain("0 или 1");
  });
});
