import { cn } from "@/lib/utils";

export type PhoneCountry = {
  iso: string;
  name: string;
  dialCode: string;
  placeholder: string;
  groups: number[];
  minDigits: number;
  maxDigits: number;
  validPrefixes?: string[];
  example: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  {
    iso: "KZ",
    name: "Казахстан",
    dialCode: "+7",
    placeholder: "700 000 00 00",
    groups: [3, 3, 2, 2],
    minDigits: 10,
    maxDigits: 10,
    validPrefixes: ["70", "74", "75", "76", "77", "78", "71", "72"],
    example: "701 234 56 78",
  },
  {
    iso: "RU",
    name: "Россия",
    dialCode: "+7",
    placeholder: "900 000 00 00",
    groups: [3, 3, 2, 2],
    minDigits: 10,
    maxDigits: 10,
    validPrefixes: ["9", "3", "4", "8"],
    example: "912 345 67 89",
  },
  {
    iso: "UZ",
    name: "Узбекистан",
    dialCode: "+998",
    placeholder: "90 000 00 00",
    groups: [2, 3, 2, 2],
    minDigits: 9,
    maxDigits: 9,
    validPrefixes: ["90", "91", "93", "94", "95", "97", "98", "99", "33", "88", "50", "20", "77", "78", "71"],
    example: "90 123 45 67",
  },
  {
    iso: "KG",
    name: "Кыргызстан",
    dialCode: "+996",
    placeholder: "700 000 000",
    groups: [3, 3, 3],
    minDigits: 9,
    maxDigits: 9,
    validPrefixes: ["22", "50", "55", "70", "77", "99", "88", "31", "20", "90"],
    example: "700 123 456",
  },
  {
    iso: "TJ",
    name: "Таджикистан",
    dialCode: "+992",
    placeholder: "900 000 000",
    groups: [3, 3, 3],
    minDigits: 9,
    maxDigits: 9,
    validPrefixes: ["90", "91", "92", "93", "98", "88", "77", "55", "50", "00", "11"],
    example: "900 123 456",
  },
  {
    iso: "TM",
    name: "Туркменистан",
    dialCode: "+993",
    placeholder: "65 000 000",
    groups: [2, 3, 3],
    minDigits: 8,
    maxDigits: 8,
    validPrefixes: ["61", "62", "63", "64", "65", "71", "12"],
    example: "65 123 456",
  },
  {
    iso: "AZ",
    name: "Азербайджан",
    dialCode: "+994",
    placeholder: "50 000 00 00",
    groups: [2, 3, 2, 2],
    minDigits: 9,
    maxDigits: 9,
    validPrefixes: ["50", "51", "55", "70", "77", "99", "12"],
    example: "50 123 45 67",
  },
  {
    iso: "AM",
    name: "Армения",
    dialCode: "+374",
    placeholder: "91 000 000",
    groups: [2, 3, 3],
    minDigits: 8,
    maxDigits: 8,
    validPrefixes: ["91", "93", "94", "95", "96", "97", "98", "99", "77", "55", "41", "43", "33", "10"],
    example: "91 123 456",
  },
  {
    iso: "GE",
    name: "Грузия",
    dialCode: "+995",
    placeholder: "599 000 000",
    groups: [3, 3, 3],
    minDigits: 9,
    maxDigits: 9,
    validPrefixes: ["5", "32"],
    example: "599 123 456",
  },
  {
    iso: "BY",
    name: "Беларусь",
    dialCode: "+375",
    placeholder: "29 000 00 00",
    groups: [2, 3, 2, 2],
    minDigits: 9,
    maxDigits: 9,
    validPrefixes: ["29", "33", "44", "25", "17"],
    example: "29 123 45 67",
  },
  {
    iso: "UA",
    name: "Украина",
    dialCode: "+380",
    placeholder: "67 000 00 00",
    groups: [2, 3, 2, 2],
    minDigits: 9,
    maxDigits: 9,
    validPrefixes: ["50", "63", "66", "67", "68", "73", "93", "95", "96", "97", "98", "99", "44"],
    example: "67 123 45 67",
  },
  {
    iso: "TR",
    name: "Турция",
    dialCode: "+90",
    placeholder: "500 000 00 00",
    groups: [3, 3, 2, 2],
    minDigits: 10,
    maxDigits: 10,
    validPrefixes: ["5"],
    example: "501 234 56 78",
  },
  {
    iso: "AE",
    name: "ОАЭ",
    dialCode: "+971",
    placeholder: "50 000 0000",
    groups: [2, 3, 4],
    minDigits: 9,
    maxDigits: 9,
    validPrefixes: ["50", "52", "54", "55", "56", "58", "2", "3", "4", "6", "7", "9"],
    example: "50 123 4567",
  },
  {
    iso: "SA",
    name: "Саудовская Аравия",
    dialCode: "+966",
    placeholder: "50 000 0000",
    groups: [2, 3, 4],
    minDigits: 9,
    maxDigits: 9,
    validPrefixes: ["50", "53", "54", "55", "56", "57", "58", "59", "11", "12", "13", "14", "17"],
    example: "50 123 4567",
  },
  {
    iso: "GB",
    name: "Великобритания",
    dialCode: "+44",
    placeholder: "7400 000000",
    groups: [4, 6],
    minDigits: 10,
    maxDigits: 10,
    validPrefixes: ["7", "1", "2"],
    example: "7400 123456",
  },
  {
    iso: "US",
    name: "США / Канада",
    dialCode: "+1",
    placeholder: "555 000 0000",
    groups: [3, 3, 4],
    minDigits: 10,
    maxDigits: 10,
    example: "555 123 4567",
  },
  {
    iso: "DE",
    name: "Германия",
    dialCode: "+49",
    placeholder: "151 00000000",
    groups: [3, 8],
    minDigits: 10,
    maxDigits: 11,
    validPrefixes: ["15", "16", "17", "30", "40", "89"],
    example: "151 12345678",
  },
  {
    iso: "OTHER",
    name: "Другая страна",
    dialCode: "+",
    placeholder: "1234567890",
    groups: [3, 3, 4],
    minDigits: 7,
    maxDigits: 15,
    example: "1234567890",
  },
];

export function getPhoneCountry(iso: string): PhoneCountry {
  return PHONE_COUNTRIES.find((country) => country.iso === iso) ?? PHONE_COUNTRIES[0];
}

export function extractNationalDigits(value: string, country: PhoneCountry): string {
  const digitsOnly = value.replace(/\D/g, "");
  const dialDigits = country.dialCode.replace(/\D/g, "");

  let national = digitsOnly;
  if (dialDigits && national.length > country.maxDigits && national.startsWith(dialDigits)) {
    national = national.slice(dialDigits.length);
  }

  return national.slice(0, country.maxDigits);
}

export function formatPhoneNational(value: string, country: PhoneCountry): string {
  const digits = extractNationalDigits(value, country);
  if (!digits) return "";

  const parts: string[] = [];
  let cursor = 0;

  for (const group of country.groups) {
    if (cursor >= digits.length) break;
    parts.push(digits.slice(cursor, cursor + group));
    cursor += group;
  }

  if (cursor < digits.length) {
    parts.push(digits.slice(cursor));
  }

  return parts.join(" ");
}

export function normalizePhoneNumber(country: PhoneCountry, nationalNumber: string): string {
  const digits = extractNationalDigits(nationalNumber, country);
  if (!digits) return "";
  const dialDigits = country.dialCode.replace(/\D/g, "");
  return dialDigits ? `+${dialDigits}${digits}` : `+${digits}`;
}

export function getPhoneValidationError(country: PhoneCountry, nationalNumber: string): string | null {
  const digits = extractNationalDigits(nationalNumber, country);

  if (!digits) {
    return "Укажите номер WhatsApp";
  }

  if (country.minDigits === country.maxDigits) {
    if (digits.length !== country.minDigits) {
      return `Номер для страны «${country.name}» должен состоять из ${country.minDigits} цифр (например, ${country.example})`;
    }
  } else {
    if (digits.length < country.minDigits || digits.length > country.maxDigits) {
      return `Номер для страны «${country.name}» должен содержать от ${country.minDigits} до ${country.maxDigits} цифр`;
    }
  }

  if (country.validPrefixes && country.validPrefixes.length > 0) {
    const matchedPrefix = country.validPrefixes.some((prefix) => digits.startsWith(prefix));
    if (!matchedPrefix) {
      if (country.iso === "KZ") {
        return `Номер для Казахстана должен начинаться с верного кода оператора (например, 701, 702, 705, 707, 708, 747, 771, 777 и др.)`;
      }
      if (country.iso === "RU") {
        return `Номер для России должен начинаться с 9 (для мобильных) или кода города (например, 912, 999...)`;
      }
      if (country.iso === "TR") {
        return `Номер для Турции должен начинаться с 5 (например, 501 234 56 78)`;
      }
      if (country.iso === "AE") {
        return `Номер для ОАЭ должен начинаться с 5 (например, 50 123 4567)`;
      }
      if (country.iso === "SA") {
        return `Номер для Саудовской Аравии должен начинаться с 5 (например, 50 123 4567)`;
      }
      return `Номер для страны «${country.name}» должен начинаться с допустимого кода (например, ${country.example})`;
    }
  }

  if (country.iso === "US") {
    if (digits.startsWith("0") || digits.startsWith("1")) {
      return `Код города в США/Канаде не может начинаться с 0 или 1`;
    }
  }

  return null;
}

export function isValidPhoneNumber(country: PhoneCountry, nationalNumber: string): boolean {
  return getPhoneValidationError(country, nationalNumber) === null;
}

type PhoneInputProps = {
  countryIso: string;
  value: string;
  onCountryChange: (countryIso: string) => void;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  required?: boolean;
};

export function PhoneInput({
  countryIso,
  value,
  onCountryChange,
  onChange,
  className,
  id = "phone",
  required,
}: PhoneInputProps) {
  const country = getPhoneCountry(countryIso);
  const currentDigits = extractNationalDigits(value, country);

  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          "flex h-12 w-full overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-sm transition-[border-color,box-shadow,background-color]",
          "hover:border-[rgb(var(--muted)/0.65)] focus-within:border-[rgb(var(--primary))] focus-within:ring-2 focus-within:ring-[rgb(var(--primary)/0.18)]",
          className
        )}
      >
        <div className="relative flex min-w-[130px] shrink-0 items-center border-r border-[rgb(var(--border))] bg-[rgb(var(--surface-elevated))]">
          <label className="sr-only" htmlFor={`${id}-country`}>
            Страна
          </label>
          <select
            id={`${id}-country`}
            value={country.iso}
            onChange={(event) => {
              const nextCountry = getPhoneCountry(event.target.value);
              onCountryChange(nextCountry.iso);
              onChange(formatPhoneNational(value, nextCountry));
            }}
            className="h-full w-full cursor-pointer appearance-none bg-transparent px-3 pr-7 text-xs font-semibold text-[rgb(var(--foreground))] outline-none"
            aria-label="Код страны"
          >
            {PHONE_COUNTRIES.map((option) => (
              <option key={option.iso} value={option.iso}>
                {option.iso} ({option.dialCode})
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 text-[10px] text-[rgb(var(--muted-foreground))]">
            ▾
          </span>
        </div>

        <label className="sr-only" htmlFor={id}>
          Номер WhatsApp
        </label>
        <input
          id={id}
          type="tel"
          value={value}
          onChange={(event) => onChange(formatPhoneNational(event.target.value, country))}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--muted))] outline-none"
          placeholder={country.placeholder}
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
        />
      </div>

      <div className="flex items-center justify-between px-1 text-[11px] text-[rgb(var(--muted-foreground))]">
        <span>{country.name} ({country.dialCode})</span>
        {currentDigits.length > 0 && (
          <span className={cn(
            currentDigits.length === country.maxDigits ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""
          )}>
            {currentDigits.length} / {country.minDigits === country.maxDigits ? country.minDigits : `${country.minDigits}-${country.maxDigits}`} цифр
          </span>
        )}
      </div>
    </div>
  );
}
