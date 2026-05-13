"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Settings as SettingsIcon,
  User,
  Mail,
  Lock,
  Target,
  Calendar,
  LogOut,
  Loader2,
  Check,
  AlertTriangle,
  Crown,
  MessageCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/app-shell";

const TARGET_BANDS = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0];
const EXAM_TYPES = [
  { value: "academic", label: "Academic" },
  { value: "general", label: "General Training" },
  { value: "unknown", label: "Не решил/а ещё" },
];
const GOALS = [
  { value: "university", label: "🎓 Поступление в университет" },
  { value: "migration", label: "✈️ Иммиграция" },
  { value: "work", label: "💼 Работа за рубежом" },
  { value: "other", label: "🎯 Другое" },
];

type Profile = {
  name: string;
  email: string;
  phone: string;
  target_band: number | null;
  exam_type: string;
  exam_date: string | null;
  goal: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState("free");

  const [profile, setProfile] = useState<Profile>({
    name: "",
    email: "",
    phone: "",
    target_band: 7.0,
    exam_type: "unknown",
    exam_date: null,
    goal: "other",
  });

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const { data } = await (sb as any)
        .from("profiles")
        .select("name, email, phone, target_band, exam_type, exam_date, goal, subscriptions(plan)")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile({
          name: data.name ?? "",
          email: data.email ?? user.email ?? "",
          phone: data.phone ?? "",
          target_band: data.target_band ?? 7.0,
          exam_type: data.exam_type ?? "unknown",
          exam_date: data.exam_date ?? null,
          goal: data.goal ?? "other",
        });
        setPlan(data.subscriptions?.[0]?.plan ?? "free");
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedFlash(false);

    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { error: updateErr } = await (sb as any)
      .from("profiles")
      .update({
        name: profile.name,
        phone: profile.phone.trim() || null,
        target_band: profile.target_band,
        exam_type: profile.exam_type,
        exam_date: profile.exam_date || null,
        goal: profile.goal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSaving(false);
    if (updateErr) {
      setError(updateErr.message);
    } else {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSaved(false);

    if (newPassword.length < 8) {
      setPwError("Пароль должен быть минимум 8 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Пароли не совпадают");
      return;
    }

    setPwSaving(true);
    const sb = createClient();
    const { error: err } = await sb.auth.updateUser({ password: newPassword });
    setPwSaving(false);

    if (err) {
      setPwError(err.message);
    } else {
      setPwSaved(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSaved(false), 3000);
    }
  }

  async function handleSignOut() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <AppShell title="Настройки">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[rgb(var(--primary))]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Настройки">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">

        {/* Subscription */}
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              plan === "free" ? "bg-gray-100" : "bg-amber-100"
            )}>
              <Crown className={cn("w-6 h-6", plan === "free" ? "text-gray-400" : "text-amber-500")} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[rgb(var(--foreground))]">
                  {plan === "free" ? "Бесплатный план" : plan === "pro_monthly" ? "Pro Monthly" : "Pro Annual"}
                </span>
                <Badge variant={plan === "free" ? "secondary" : "default"}>{plan}</Badge>
              </div>
              <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
                {plan === "free" ? "Ограниченный доступ к функциям" : "Полный доступ ко всему контенту"}
              </p>
            </div>
            {plan === "free" && (
              <Link href="/pricing">
                <Button size="sm">Улучшить</Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Profile */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <User className="w-4 h-4 text-[rgb(var(--primary))]" />
              <h2 className="font-semibold text-[rgb(var(--foreground))]">Профиль</h2>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {savedFlash && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
                <Check className="w-4 h-4" />Сохранено
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1.5 block">Имя</label>
                <Input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1.5 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--muted))]" />
                  <Input type="email" value={profile.email} disabled className="pl-9 bg-[rgb(var(--muted)/0.05)]" />
                </div>
                <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">
                  Для смены email напишите в поддержку
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1.5 block flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />WhatsApp
                </label>
                <Input
                  type="tel"
                  placeholder="+7 700 000 00 00"
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  inputMode="tel"
                />
                <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">
                  Для связи в WhatsApp — без верификации
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1.5 block flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />Целевой балл
                </label>
                <div className="flex flex-wrap gap-2">
                  {TARGET_BANDS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setProfile((p) => ({ ...p, target_band: b }))}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors",
                        profile.target_band === b
                          ? "bg-[rgb(var(--primary))] text-white border-[rgb(var(--primary))]"
                          : "border-[rgb(var(--border))] hover:border-[rgb(var(--primary))]"
                      )}
                    >
                      {b.toFixed(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1.5 block">Тип экзамена</label>
                <div className="flex flex-wrap gap-2">
                  {EXAM_TYPES.map((e) => (
                    <button
                      key={e.value}
                      type="button"
                      onClick={() => setProfile((p) => ({ ...p, exam_type: e.value }))}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm border transition-colors",
                        profile.exam_type === e.value
                          ? "bg-[rgb(var(--primary))] text-white border-[rgb(var(--primary))]"
                          : "border-[rgb(var(--border))] hover:border-[rgb(var(--primary))]"
                      )}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1.5 block">Цель</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {GOALS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setProfile((p) => ({ ...p, goal: g.value }))}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm border text-left transition-colors",
                        profile.goal === g.value
                          ? "bg-[rgb(var(--primary)/0.08)] border-[rgb(var(--primary))]"
                          : "border-[rgb(var(--border))] hover:border-[rgb(var(--primary))]"
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[rgb(var(--muted-foreground))] mb-1.5 block flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />Дата экзамена
                </label>
                <Input
                  type="date"
                  value={profile.exam_date ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, exam_date: e.target.value || null }))}
                />
              </div>

              <Button type="submit" disabled={saving} className="w-full sm:w-auto self-end">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Сохранить
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Password */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <Lock className="w-4 h-4 text-[rgb(var(--primary))]" />
              <h2 className="font-semibold text-[rgb(var(--foreground))]">Сменить пароль</h2>
            </div>

            {pwError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
                {pwError}
              </div>
            )}

            {pwSaved && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
                <Check className="w-4 h-4" />Пароль обновлён
              </div>
            )}

            <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
              <Input
                type="password"
                placeholder="Новый пароль (мин. 8 символов)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
              <Input
                type="password"
                placeholder="Повторите пароль"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <Button type="submit" variant="outline" disabled={pwSaving} className="w-full sm:w-auto self-end">
                {pwSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Обновить пароль
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Logout */}
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-[rgb(var(--foreground))]">Выйти из аккаунта</h3>
              <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
                Безопасный выход со всех устройств
              </p>
            </div>
            <Button variant="outline" onClick={handleSignOut} className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200">
              <LogOut className="w-4 h-4 mr-2" />Выйти
            </Button>
          </CardContent>
        </Card>

      </div>
    </AppShell>
  );
}
