import { cn } from "@/lib/utils";

export type PhoneCountry = {
  iso: string;
  name: string;
  dialCode: string;
  placeholder: string;
  groups: number[];
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "KZ", name: "Казахстан", dialCode: "+7", placeholder: "700 000 00 00", groups: [3, 3, 2, 2] },
  { iso: "RU", name: "Россия", dialCode: "+7", placeholder: "900 000 00 00", groups: [3, 3, 2, 2] },
  { iso: "KG", name: "Кыргызстан", dialCode: "+996", placeholder: "700 000 000", groups: [3, 3, 3] },
  { iso: "UZ", name: "Узбекистан", dialCode: "+998", placeholder: "90 000 00 00", groups: [2, 3, 2, 2] },
  { iso: "TR", name: "Турция", dialCode: "+90", placeholder: "500 000 00 00", groups: [3, 3, 2, 2] },
  { iso: "AE", name: "ОАЭ", dialCode: "+971", placeholder: "50 000 0000", groups: [2, 3, 4] },
  { iso: "GB", name: "Великобритания", dialCode: "+44", placeholder: "7400 000000", groups: [4, 6] },
  { iso: "US", name: "США", dialCode: "+1", placeholder: "555 000 0000", groups: [3, 3, 4] },
];

export function getPhoneCountry(iso: string) {
  return PHONE_COUNTRIES.find((country) => country.iso === iso) ?? PHONE_COUNTRIES[0];
}

export function formatPhoneNational(value: string, country: PhoneCountry) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
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

export function normalizePhoneNumber(country: PhoneCountry, nationalNumber: string) {
  const dialDigits = country.dialCode.replace(/\D/g, "");
  const nationalDigits = nationalNumber.replace(/\D/g, "");
  const cleanNationalDigits = nationalDigits.startsWith(dialDigits)
    ? nationalDigits.slice(dialDigits.length)
    : nationalDigits;

  if (!cleanNationalDigits) return "";

  return `+${dialDigits}${cleanNationalDigits}`;
}

export function isValidPhoneNumber(country: PhoneCountry, nationalNumber: string) {
  const normalized = normalizePhoneNumber(country, nationalNumber);
  const totalDigits = normalized.replace(/\D/g, "");
  const dialDigits = country.dialCode.replace(/\D/g, "");
  const nationalDigitsCount = Math.max(0, totalDigits.length - dialDigits.length);

  return nationalDigitsCount >= 7 && nationalDigitsCount <= 12;
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

  return (
    <div
      className={cn(
        "flex h-12 w-full overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-sm transition-[border-color,box-shadow,background-color]",
        "hover:border-[rgb(var(--muted)/0.65)] focus-within:border-[rgb(var(--primary))] focus-within:ring-2 focus-within:ring-[rgb(var(--primary)/0.18)]",
        className
      )}
    >
      <div className="relative flex min-w-[126px] shrink-0 items-center border-r border-[rgb(var(--border))] bg-[rgb(var(--surface-elevated))]">
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
          className="h-full w-full cursor-pointer appearance-none bg-transparent px-3 pr-7 text-sm font-semibold text-[rgb(var(--foreground))] outline-none"
          aria-label="Код страны"
        >
          {PHONE_COUNTRIES.map((option) => (
            <option key={option.iso} value={option.iso}>
              {option.iso} {option.dialCode}
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
  );
}
