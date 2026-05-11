"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Mail, Lock, User, ChevronRight, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const TARGET_BANDS = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0];
const EXAM_TYPES = ["Academic", "General Training", "Не решил/а ещё"];
const GOALS = [
  { value: "university", label: "🎓 Поступление в университет" },
  { value: "migration", label: "✈️ Иммиграция" },
  { value: "work", label: "💼 Работа за рубежом" },
  { value: "other", label: "🎯 Другое" },
];

type Step = "account" | "onboarding";

export default function SignupPage() {
  const [step, setStep] = useState<Step>("account");
  const [showPassword, setShowPassword] = useState(false);

  // Account fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Onboarding fields
  const [targetBand, setTargetBand] = useState<number | null>(null);
  const [examType, setExamType] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [examDate, setExamDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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

    // Sign up
    const { data, error: signUpError } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
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

      await (sb as any).from("profiles").update({
        name,
        target_band: targetBand,
        exam_type: examType ? examTypeMap[examType] : "unknown",
        goal,
        exam_date: examDate || null,
      }).eq("id", data.user.id);
    }

    router.push("/dashboard");
    router.refresh();
  }

  // ─── Step 1: Account ───────────────────────────────────────────────────────
  if (step === "account") {
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
            <p className="text-sm text-[rgb(var(--muted-foreground))] mb-6">
              Уже есть аккаунт?{" "}
              <Link href="/login" className="text-[rgb(var(--primary))] font-medium hover:underline">
                Войти
              </Link>
            </p>

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
