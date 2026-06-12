"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const sb = createClient();
    const { error: authError } = await sb.auth.signInWithPassword({ email, password });

    if (authError) {
      const msg = authError.message;
      if (msg === "Invalid login credentials") {
        setError("Неверный email или пароль");
      } else if (msg.toLowerCase().includes("email not confirmed") || msg.toLowerCase().includes("not verified")) {
        setError("Email не подтверждён. Проверьте почту и перейдите по ссылке из письма.");
      } else {
        setError(msg);
      }
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleResendVerification() {
    if (!email) {
      setError("Введите email чтобы переотправить письмо");
      return;
    }
    setError(null);
    const sb = createClient();
    const emailRedirectUrl = new URL("/api/auth/callback", window.location.origin);
    emailRedirectUrl.searchParams.set("next", "/signup?premium=1");
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { error: resendErr } = await (sb as any).auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: emailRedirectUrl.toString() },
    });
    if (resendErr) {
      setError(resendErr.message);
    } else {
      setError("Письмо отправлено повторно. Проверьте почту.");
    }
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-violet-100/50 blur-3xl -translate-y-1/2" aria-hidden />
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mb-8 animate-fade-in">
        <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
          <span className="text-white font-bold text-sm">IZ</span>
        </div>
        <span className="font-semibold text-[rgb(var(--foreground))] text-lg">ieltszen</span>
      </Link>

      <div className="w-full max-w-sm animate-scale-in">
        <div className="bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border))] shadow-lg shadow-black/5 p-8">
          <h1 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-1">Войти</h1>
          <p className="text-sm text-[rgb(var(--muted-foreground))] mb-6">
            Нет аккаунта?{" "}
            <Link
              href="/signup"
              className="text-[rgb(var(--primary))] font-medium hover:underline"
            >
              Зарегистрироваться
            </Link>
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-2">
              <div>{error}</div>
              {error.includes("не подтверждён") && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="mt-2 text-xs font-medium text-red-900 underline hover:no-underline"
                >
                  Отправить письмо повторно
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
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

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--muted))]" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 pr-10"
                required
                autoComplete="current-password"
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

            {/* Forgot */}
            <div className="text-right -mt-1">
              <Link
                href="/forgot-password"
                className="text-xs text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--primary))] transition-colors"
              >
                Забыли пароль?
              </Link>
            </div>

            <Button type="submit" size="lg" className="w-full mt-1" disabled={loading}>
              {loading ? "Входим..." : "Войти"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-[rgb(var(--muted))] mt-6">
          Нажимая «Войти», вы соглашаетесь с{" "}
          <Link href="/terms" className="underline hover:text-[rgb(var(--foreground))] transition-colors">
            условиями использования
          </Link>
        </p>
      </div>
    </div>
  );
}
