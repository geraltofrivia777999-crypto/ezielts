"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getPhoneCountry,
  isValidPhoneNumber,
  normalizePhoneNumber,
  PhoneInput,
} from "@/components/forms/phone-input";
import { PaymentChoiceButton } from "@/components/payment/payment-choice-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  MailCheck,
  MessageCircle,
  Crown,
  CheckCircle2,
  ArrowRight,
  Shield,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Step = "account" | "verify" | "premium";

const PREMIUM_FEATURES = [
  "Все тесты без лимита",
  "Writing — безлимит проверок",
  "Speaking — безлимит сессий",
  "Персональный AI-план",
  "AI Tutor — продвинутый",
  "Детальный анализ ошибок",
  "Прогресс-трекер",
  "Гарантия +1 band",
];

function SignupFallback() {
  return (
    <div className="min-h-screen bg-[rgb(var(--background))] flex items-center justify-center p-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
          <span className="text-white font-bold text-sm">EZ</span>
        </div>
        <span className="font-semibold text-[rgb(var(--foreground))] text-lg">ielts</span>
      </div>
    </div>
  );
}

function SignupContent() {
  const [step, setStep] = useState<Step>("account");
  const [showPassword, setShowPassword] = useState(false);

  // Account fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("KZ");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDiagnostic] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("from") === "diagnostic"
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const visibleStep: Step = searchParams.get("premium") === "1" ? "premium" : step;

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Пароль должен быть не менее 8 символов");
      return;
    }

    const selectedPhoneCountry = getPhoneCountry(phoneCountry);
    if (!isValidPhoneNumber(selectedPhoneCountry, phone)) {
      setError("Укажите корректный номер WhatsApp с кодом страны");
      return;
    }

    setLoading(true);
    setError(null);

    const sb = createClient();
    const emailRedirectUrl = new URL("/api/auth/callback", window.location.origin);
    emailRedirectUrl.searchParams.set("next", "/signup?premium=1");
    const normalizedPhone = normalizePhoneNumber(selectedPhoneCountry, phone);

    // Sign up
    const { data, error: signUpError } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
          phone: normalizedPhone,
          phone_country: selectedPhoneCountry.iso,
        },
        emailRedirectTo: emailRedirectUrl.toString(),
      },
    });

    if (signUpError) {
      setError(signUpError.message === "User already registered"
        ? "Пользователь с таким email уже существует"
        : signUpError.message);
      setLoading(false);
      return;
    }

    // Mark this browser so middleware can redirect to premium popup
    // even if the email callback redirect fails (e.g. different browser, expired code)
    document.cookie = "ez_show_premium=1; path=/; max-age=86400; SameSite=Lax";

    // Update profile with basic data
    if (data.user) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      await (sb as any).from("profiles").update({
        name: name.trim(),
        phone: normalizedPhone,
      }).eq("id", data.user.id);
    }

    setLoading(false);

    // If email confirmation is required, session is null — show "check inbox"
    if (!data.session) {
      setStep("verify");
      return;
    }

    // Otherwise (email confirmation disabled), session is set — show the upgrade prompt.
    setStep("premium");
    router.refresh();
  }

  // Mark premium popup as seen — prevents middleware from redirecting here again.
  useEffect(() => {
    if (visibleStep === "premium") {
      document.cookie = "ez_seen_premium=1; path=/; max-age=31536000; SameSite=Lax";
      document.cookie = "ez_show_premium=; path=/; max-age=0";
    }
  }, [visibleStep]);

  // ─── Step 1: Account ───────────────────────────────────────────────────────
  if (visibleStep === "account") {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-violet-100/50 blur-3xl -translate-y-1/2" aria-hidden />
        <Link href="/" className="flex items-center gap-2 mb-8 animate-fade-in">
          <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
            <span className="text-white font-bold text-sm">EZ</span>
          </div>
          <span className="font-semibold text-[rgb(var(--foreground))] text-lg">ielts</span>
        </Link>

        <div className="w-full max-w-sm animate-scale-in">
          <div className="bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border))] shadow-lg shadow-black/5 p-8">
            <h1 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-1">
              Создать аккаунт
            </h1>
            {!fromDiagnostic && (
              <p className="text-sm text-[rgb(var(--muted-foreground))] mb-6">
                Уже есть аккаунт?{" "}
                <Link href="/login" className="text-[rgb(var(--primary))] font-medium hover:underline">
                  Войти
                </Link>
              </p>
            )}
            {fromDiagnostic && (
              <p className="text-sm text-[rgb(var(--muted-foreground))] mb-6">
                Создай аккаунт, чтобы сохранить диагностику и открыть персональный план.
              </p>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-2">
                {error}
              </div>
            )}

            <form onSubmit={handleAccountSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--muted))]" />
                <Input
                  placeholder="Имя"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9"
                  required
                  autoComplete="name"
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--muted))]" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="signup-phone" className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[rgb(var(--muted-foreground))]">
                  <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                  WhatsApp <span className="text-red-500">*</span>
                </label>
                <PhoneInput
                  id="signup-phone"
                  countryIso={phoneCountry}
                  value={phone}
                  onCountryChange={setPhoneCountry}
                  onChange={setPhone}
                  required
                />
                <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1 ml-1">
                  Выберите страну и укажите номер, чтобы менеджер мог связаться после регистрации
                </p>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--muted))]" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Пароль (минимум 8 символов)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Button type="submit" size="lg" className="w-full mt-1" disabled={loading}>
                {loading ? "Создаём аккаунт..." : "Создать аккаунт"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 3: Email verification ───────────────────────────────────────────
  if (visibleStep === "verify") {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col items-center justify-center p-4">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
            <span className="text-white font-bold text-sm">EZ</span>
          </div>
          <span className="font-semibold text-[rgb(var(--foreground))] text-lg">ielts</span>
        </Link>

        <div className="w-full max-w-md">
          <div className="bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border))] shadow-sm p-8 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <MailCheck className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-[rgb(var(--foreground))]">
              Проверьте почту
            </h1>
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              Мы отправили письмо на <strong className="text-[rgb(var(--foreground))]">{email}</strong>.
              Перейдите по ссылке в письме, чтобы активировать аккаунт.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 text-left w-full">
              <strong className="block mb-1">Не пришло письмо?</strong>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Проверьте папку &quot;Спам&quot;</li>
                <li>Подождите 1–2 минуты</li>
                <li>Убедитесь, что email указан правильно</li>
              </ul>
            </div>

            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full">
                Перейти ко входу
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 4: Premium prompt ───────────────────────────────────────────────
  if (visibleStep === "premium") {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] relative overflow-hidden">
        {/* Decorative background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-[rgb(var(--primary)/0.06)] blur-[100px]" />
        </div>

        <div className="relative flex flex-col items-center min-h-screen px-4 pt-10 pb-12 sm:pt-16 sm:justify-center">
          <div className="w-full max-w-md text-center">
            {/* Success badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[rgb(var(--success)/0.08)] border border-[rgb(var(--success)/0.2)] px-4 py-2 text-sm font-medium text-[rgb(var(--success))]">
              <CheckCircle2 className="h-4 w-4" />
              Аккаунт создан
            </div>

            {/* Heading */}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[rgb(var(--foreground))] leading-tight mb-2">
              Открой полный доступ к IELTS подготовке
            </h1>
            <p className="text-sm text-[rgb(var(--muted-foreground))] mb-8">
              Всё что нужно для целевого балла — в одной подписке
            </p>

            {/* Pricing card */}
            <div className="rounded-2xl border-2 border-[rgb(var(--primary)/0.3)] bg-[rgb(var(--surface))] shadow-xl shadow-[rgb(var(--primary)/0.06)] overflow-hidden">
              {/* Card header */}
              <div className="bg-[rgb(var(--primary))] px-6 py-4">
                <div className="flex items-center justify-center gap-2 text-white/80 text-xs font-semibold uppercase tracking-widest mb-1">
                  <Crown className="h-3.5 w-3.5" />
                  Лучший выбор
                </div>
                <div className="flex items-baseline justify-center gap-1 text-white">
                  <span className="text-4xl font-bold">$12</span>
                  <span className="text-white/70 text-sm">/мес</span>
                </div>
                <div className="text-white/60 text-xs mt-1">$36 за 3 месяца</div>
              </div>

              {/* Features list */}
              <div className="p-5 sm:p-6">
                <div className="grid gap-2.5">
                  {PREMIUM_FEATURES.map((feature) => (
                    <div key={feature} className="flex items-center gap-3 text-left">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[rgb(var(--success))]" />
                      <span className="text-sm text-[rgb(var(--foreground))]">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-[rgb(var(--border))]" />

              {/* CTA inside card */}
              <div className="p-5 sm:p-6">
                <PaymentChoiceButton size="lg" className="w-full shadow-lg shadow-[rgb(var(--primary)/0.25)]" />
                <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-[rgb(var(--muted-foreground))]">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Гарантия +1 band
                  </span>
                  <span className="h-3 w-px bg-[rgb(var(--border))]" />
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Отмена в любой момент
                  </span>
                </div>
              </div>
            </div>

            {/* Free plan button */}
            <div className="mt-3">
              <Button variant="outline" size="lg" className="w-full" asChild>
                <Link href="/dashboard">
                  Готовиться бесплатно
                </Link>
              </Button>
            </div>

            {/* Other plans link */}
            <div className="mt-4">
              <Link
                href="/pricing"
                className="text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-colors underline underline-offset-4 decoration-[rgb(var(--border))]"
              >
                Сравнить все тарифы
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Fallback (should not reach here) ──────────────────────────────────
  return null;
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupContent />
    </Suspense>
  );
}
