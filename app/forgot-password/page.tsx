"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const sb = createClient();
    const { error: err } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
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
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-[rgb(var(--foreground))] mb-2">
                Письмо отправлено!
              </h1>
              <p className="text-sm text-[rgb(var(--muted-foreground))] mb-6">
                Проверьте {email} — мы прислали ссылку для сброса пароля.
              </p>
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  Вернуться ко входу
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-1">
                Забыли пароль?
              </h1>
              <p className="text-sm text-[rgb(var(--muted-foreground))] mb-6">
                Введите email, и мы пришлём ссылку для сброса.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? "Отправляем..." : "Сбросить пароль"}
                </Button>
              </form>

              <p className="text-center text-sm text-[rgb(var(--muted-foreground))] mt-4">
                Вспомнили пароль?{" "}
                <Link href="/login" className="text-[rgb(var(--primary))] font-medium hover:underline">
                  Войти
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
