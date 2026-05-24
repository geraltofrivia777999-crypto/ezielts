"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ChevronRight,
  Target,
  MailCheck,
  MessageCircle,
  Crown,
  CalendarDays,
  Bot,
  BarChart3,
  FileCheck2,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Shield,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const TARGET_BANDS = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0];
const EXAM_TYPES = ["Academic", "General Training", "Не решил/а ещё"];
const GOALS = [
  { value: "university", label: "🎓 Поступление в университет" },
  { value: "migration", label: "✈️ Иммиграция" },
  { value: "work", label: "💼 Работа за рубежом" },
  { value: "other", label: "🎯 Другое" },
];

type Step = "account" | "onboarding" | "verify" | "premium";

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
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Onboarding fields
  const [targetBand, setTargetBand] = useState<number | null>(null);
  const [examType, setExamType] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [examDate, setExamDate] = useState("");

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
    setError(null);
    setStep("onboarding");
  }

  async function handleOnboardingSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const sb = createClient();
    const emailRedirectUrl = new URL("/api/auth/callback", window.location.origin);
    emailRedirectUrl.searchParams.set("next", "/signup?premium=1");

    // Sign up
    const { data, error: signUpError } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { name },
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

    // Update profile with onboarding data
    if (data.user) {
      const examTypeMap: Record<string, "academic" | "general" | "unknown"> = {
        "Academic": "academic",
        "General Training": "general",
        "Не решил/а ещё": "unknown",
      };

      /* eslint-disable @typescript-eslint/no-explicit-any */
      await (sb as any).from("profiles").update({
        name,
        phone: phone.trim() || null,
        target_band: targetBand,
        exam_type: examType ? examTypeMap[examType] : "unknown",
        goal,
        exam_date: examDate || null,
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
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-[rgb(var(--primary))] flex items-center justify-center">
                  <span className="text-white text-xs font-bold">1</span>
                </div>
                <span className="text-xs font-medium text-[rgb(var(--primary))]">Аккаунт</span>
              </div>
              <div className="flex-1 h-px bg-[rgb(var(--border))]" />
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-[rgb(var(--border))] flex items-center justify-center">
                  <span className="text-[rgb(var(--muted-foreground))] text-xs font-bold">2</span>
                </div>
                <span className="text-xs text-[rgb(var(--muted-foreground))]">О вас</span>
              </div>
            </div>

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
                <div className="relative">
                  <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#25D366]" />
                  <Input
                    type="tel"
                    placeholder="+7 700 000 00 00 (WhatsApp)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-9"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
                <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1 ml-1">
                  Для связи в WhatsApp — без верификации
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

              <Button type="submit" size="lg" className="w-full mt-1">
                Продолжить
                <ChevronRight className="w-4 h-4" />
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
                <Button size="lg" className="w-full shadow-lg shadow-[rgb(var(--primary)/0.25)]" asChild>
                  <Link href="/checkout?plan=pro_quarterly">
                    Начать подготовку с Pro
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
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

            {/* Other plans link */}
            <div className="mt-4">
              <Link
                href="/pricing"
                className="text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-colors underline underline-offset-4 decoration-[rgb(var(--border))]"
              >
                Все тарифы
              </Link>
            </div>

            {/* Skip link */}
            <div className="mt-6">
              <Link
                href="/dashboard"
                className="text-xs text-[rgb(var(--muted))] hover:text-[rgb(var(--muted-foreground))] transition-colors"
              >
                Продолжить с бесплатным планом
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 2: Onboarding ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col items-center justify-center p-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
          <span className="text-white font-bold text-sm">EZ</span>
        </div>
        <span className="font-semibold text-[rgb(var(--foreground))] text-lg">ielts</span>
      </Link>

      <div className="w-full max-w-sm">
        <div className="bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border))] shadow-sm p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-[rgb(var(--success))] flex items-center justify-center">
                <span className="text-white text-xs font-bold">✓</span>
              </div>
              <span className="text-xs text-[rgb(var(--muted-foreground))]">Аккаунт</span>
            </div>
            <div className="flex-1 h-px bg-[rgb(var(--primary))]" />
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-[rgb(var(--primary))] flex items-center justify-center">
                <span className="text-white text-xs font-bold">2</span>
              </div>
              <span className="text-xs font-medium text-[rgb(var(--primary))]">О вас</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-1">
            <Target className="w-5 h-5 text-[rgb(var(--primary))]" />
            <h1 className="text-xl font-bold text-[rgb(var(--foreground))]">Расскажи о своих целях</h1>
          </div>
          <p className="text-sm text-[rgb(var(--muted-foreground))] mb-6">
            Алгоритм подберёт персональный план под твои задачи
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-2">
              {error}
            </div>
          )}

          <form onSubmit={handleOnboardingSubmit} className="flex flex-col gap-6">
            {/* Target band */}
            <div>
              <label className="text-sm font-medium text-[rgb(var(--foreground))] mb-2 block">
                Целевой балл
              </label>
              <div className="flex flex-wrap gap-2">
                {TARGET_BANDS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setTargetBand(b)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-mono font-semibold border transition-all",
                      targetBand === b
                        ? "bg-[rgb(var(--primary))] border-[rgb(var(--primary))] text-white"
                        : "bg-[rgb(var(--surface))] border-[rgb(var(--border))] text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.5)]"
                    )}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Exam type */}
            <div>
              <label className="text-sm font-medium text-[rgb(var(--foreground))] mb-2 block">
                Тип теста
              </label>
              <div className="flex flex-col gap-2">
                {EXAM_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setExamType(t)}
                    className={cn(
                      "w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all",
                      examType === t
                        ? "bg-[rgb(var(--primary)/0.08)] border-[rgb(var(--primary))] font-medium text-[rgb(var(--primary))]"
                        : "bg-transparent border-[rgb(var(--border))] text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.4)]"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Goal */}
            <div>
              <label className="text-sm font-medium text-[rgb(var(--foreground))] mb-2 block">
                Цель
              </label>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGoal(value)}
                    className={cn(
                      "text-left px-3 py-2.5 rounded-xl border text-xs font-medium transition-all leading-snug",
                      goal === value
                        ? "bg-[rgb(var(--primary)/0.08)] border-[rgb(var(--primary))] text-[rgb(var(--primary))]"
                        : "bg-transparent border-[rgb(var(--border))] text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.4)]"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Exam date (optional) */}
            <div>
              <label className="text-sm font-medium text-[rgb(var(--foreground))] mb-1 block">
                Дата экзамена{" "}
                <Badge variant="outline" className="ml-1 text-[10px] py-0">необязательно</Badge>
              </label>
              <Input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading || !targetBand || !examType || !goal}
            >
              {loading ? "Создаём аккаунт..." : "Начать подготовку"}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupContent />
    </Suspense>
  );
}
