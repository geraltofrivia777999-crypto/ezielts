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
      setError(authError.message === "Invalid login credentials"
        ? "Неверный email или пароль"
        : authError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
          <span className="text-white font-bold text-sm">EZ</span>
        </div>
        <span className="font-semibold text-[rgb(var(--foreground))] text-lg">ielts</span>
      </Link>

      <div className="w-full max-w-sm">
        <div className="bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border))] shadow-sm p-8">
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
              {error}
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
