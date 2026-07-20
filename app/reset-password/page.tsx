"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const sb = createClient();
    let active = true;

    void sb.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      setSessionReady(Boolean(user));
      setCheckingSession(false);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(true);
        setCheckingSession(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов.");
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают.");
      return;
    }

    setLoading(true);
    const sb = createClient();
    const { error: err } = await sb.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setDone(true);
      setTimeout(() => router.replace("/dashboard"), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col items-center justify-center p-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
          <span className="text-white font-bold text-sm">IZ</span>
        </div>
        <span className="font-semibold text-[rgb(var(--foreground))] text-lg">ieltszen</span>
      </Link>

      <div className="w-full max-w-sm">
        <div className="bg-[rgb(var(--surface))] rounded-2xl border border-[rgb(var(--border))] shadow-sm p-8">
          {done ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-[rgb(var(--foreground))] mb-2">
                Пароль обновлён!
              </h1>
              <p className="text-sm text-[rgb(var(--muted-foreground))]">
                Перенаправляем в дашборд...
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="w-5 h-5 text-[rgb(var(--primary))]" />
                <h1 className="text-2xl font-bold text-[rgb(var(--foreground))]">
                  Новый пароль
                </h1>
              </div>
              <p className="text-sm text-[rgb(var(--muted-foreground))] mb-6">
                Введите новый пароль для вашего аккаунта.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
                  {error}
                </div>
              )}

              {checkingSession && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg px-3 py-2 mb-4">
                  Проверяем ссылку для сброса пароля...
                </div>
              )}

              {!checkingSession && !sessionReady && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg px-3 py-2 mb-4">
                  Ссылка недействительна или уже истекла. Запросите новое письмо для сброса пароля.
                  <Link href="/forgot-password" className="mt-2 block font-semibold underline underline-offset-2">
                    Запросить новую ссылку
                  </Link>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="Новый пароль (мин. 8 символов)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="Повторите пароль"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={loading || !sessionReady}
                >
                  {loading ? "Сохраняем..." : "Сохранить пароль"}
                </Button>
              </form>

              <p className="text-center text-sm text-[rgb(var(--muted-foreground))] mt-4">
                <Link href="/login" className="text-[rgb(var(--primary))] font-medium hover:underline">
                  Вернуться ко входу
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
