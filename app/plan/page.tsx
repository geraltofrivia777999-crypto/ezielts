"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PaymentChoiceButton } from "@/components/payment/payment-choice-button";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Target,
  BookOpen,
  Headphones,
  PenLine,
  Mic2,
  CheckCircle2,
  Lock,
  Loader2,
  Sparkles,
  TrendingUp,
  Flame,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/app-shell";
import { hasActiveProAccess } from "@/lib/supabase/access";

type Profile = {
  name: string | null;
  target_band: number | null;
  exam_date: string | null;
  band_reading: number | null;
  band_listening: number | null;
  band_writing: number | null;
  band_speaking: number | null;
};

type Task = {
  day: number;
  title: string;
  skill: "reading" | "listening" | "writing" | "speaking" | "mixed";
  duration: number; // minutes
  href: string;
  done?: boolean;
};

const SKILL_META = {
  reading: { icon: BookOpen, color: "text-blue-500", bg: "bg-blue-50", label: "Reading" },
  listening: { icon: Headphones, color: "text-purple-500", bg: "bg-purple-50", label: "Listening" },
  writing: { icon: PenLine, color: "text-teal-500", bg: "bg-teal-50", label: "Writing" },
  speaking: { icon: Mic2, color: "text-violet-500", bg: "bg-violet-50", label: "Speaking" },
  mixed: { icon: Sparkles, color: "text-amber-500", bg: "bg-amber-50", label: "Микс" },
};

function buildPlan(profile: Profile, isPro: boolean): Task[] {
  // Identify weakest skill
  const skills: Array<{ key: "reading" | "listening" | "writing" | "speaking"; band: number }> = [
    { key: "reading", band: profile.band_reading ?? 5.0 },
    { key: "listening", band: profile.band_listening ?? 5.0 },
    { key: "writing", band: profile.band_writing ?? 5.0 },
    { key: "speaking", band: profile.band_speaking ?? 5.0 },
  ];
  skills.sort((a, b) => a.band - b.band);
  const weakest = skills[0].key;
  const secondWeakest = skills[1].key;

  // Generate 7-day plan focused on weakest skills
  const plan: Task[] = [];
  for (let i = 1; i <= 7; i++) {
    const isOdd = i % 2 === 1;
    const skill = isOdd ? weakest : secondWeakest;
    const meta = SKILL_META[skill];

    plan.push({
      day: i,
      title: `${meta.label} — практика`,
      skill,
      duration: skill === "writing" || skill === "speaking" ? 40 : 25,
      href: `/tests?skill=${skill}`,
    });
  }

  // If Pro, add weekly mock exam
  if (isPro) {
    plan.push({
      day: 7,
      title: "Mock-экзамен (все скиллы)",
      skill: "mixed",
      duration: 165,
      href: "/diagnostic",
    });
  }

  return plan;
}

function daysUntilExam(date: string | null): number | null {
  if (!date) return null;
  const exam = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

type AIDay = {
  day: number;
  title: string;
  skill: "reading" | "listening" | "writing" | "speaking" | "mixed";
  duration_min: number;
  focus_area: string;
  exercise_suggestion: string;
};

type AIPlan = {
  focus_skills: string[];
  overall_strategy: string;
  days: AIDay[];
};

export default function PlanPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [plan, setPlan] = useState<Task[]>([]);
  const [aiPlan, setAiPlan] = useState<AIPlan | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const [profileRes, summaryRes] = await Promise.all([
        (sb as any)
          .from("profiles")
          .select("name, target_band, exam_date, band_reading, band_listening, band_writing, band_speaking")
          .eq("id", user.id)
          .single(),
        (sb as any)
          .from("v_user_summary")
          .select("is_pro, plan, subscription_status, current_period_end")
          .eq("id", user.id)
          .single(),
      ]);

      const data = profileRes.data;
      if (data) {
        const p: Profile = {
          name: data.name,
          target_band: data.target_band,
          exam_date: data.exam_date,
          band_reading: data.band_reading,
          band_listening: data.band_listening,
          band_writing: data.band_writing,
          band_speaking: data.band_speaking,
        };
        const proStatus = hasActiveProAccess(summaryRes.data);
        setIsPro(proStatus);
        setProfile(p);
        setPlan(buildPlan(p, proStatus));
      }
      setLoading(false);
    }
    load();
  }, []);

  async function generateAIPlan() {
    if (!isPro) {
      setAiError("AI-план доступен только по подписке. Купите Pro, чтобы открыть генерацию.");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/study-plan", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? data.error ?? "API error");
      }
      const data: AIPlan = await res.json();
      setAiPlan(data);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Не удалось сгенерировать план");
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) {
    return (
      <AppShell title="AI план">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[rgb(var(--primary))]" />
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell title="AI план">
        <div className="flex items-center justify-center py-20">
          <Link href="/login"><Button>Войти</Button></Link>
        </div>
      </AppShell>
    );
  }

  const daysLeft = daysUntilExam(profile.exam_date);
  const currentAvg = [profile.band_reading, profile.band_listening, profile.band_writing, profile.band_speaking]
    .filter((b): b is number => b !== null && b > 0);
  const currentBand = currentAvg.length
    ? Math.round((currentAvg.reduce((s, b) => s + b, 0) / currentAvg.length) * 2) / 2
    : null;
  const targetBand = profile.target_band ?? 7.0;
  const gap = currentBand !== null ? targetBand - currentBand : null;

  type SkillRow = { key: "reading" | "listening" | "writing" | "speaking"; band: number; label: string; icon: React.ElementType; color: string };
  const skills: SkillRow[] = ([
    { key: "reading", band: profile.band_reading ?? 0, label: "Reading", icon: BookOpen, color: "text-blue-500" },
    { key: "listening", band: profile.band_listening ?? 0, label: "Listening", icon: Headphones, color: "text-purple-500" },
    { key: "writing", band: profile.band_writing ?? 0, label: "Writing", icon: PenLine, color: "text-teal-500" },
    { key: "speaking", band: profile.band_speaking ?? 0, label: "Speaking", icon: Mic2, color: "text-violet-500" },
  ] as SkillRow[]).sort((a, b) => (b.band || 0) - (a.band || 0));

  return (
    <AppShell title="AI план">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {!isPro && (
          <div className="flex justify-end">
            <Badge variant="secondary">Free preview</Badge>
          </div>
        )}

        {/* Pro lock banner */}
        {!isPro && (
          <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
            <CardContent className="p-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-[rgb(var(--foreground))] mb-1">Доступен в Pro</h3>
                <p className="text-sm text-[rgb(var(--muted-foreground))] mb-3">
                  Это превью базового плана. С Pro получишь: расширенный план на 30 дней, mock-экзамены, AI-подбор упражнений по слабым местам.
                </p>
                <PaymentChoiceButton size="sm" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Goal overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center">
                <Target className="w-6 h-6 text-violet-500" />
              </div>
              <div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">Текущий → Цель</div>
                <div className="font-mono text-xl font-bold text-[rgb(var(--foreground))]">
                  {currentBand?.toFixed(1) ?? "—"} → {targetBand.toFixed(1)}
                </div>
                {gap !== null && gap > 0 && (
                  <div className="text-xs text-[rgb(var(--muted-foreground))]">+{gap.toFixed(1)} band до цели</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">Дней до экзамена</div>
                <div className="font-mono text-xl font-bold text-[rgb(var(--foreground))]">
                  {daysLeft !== null ? (daysLeft >= 0 ? daysLeft : "—") : "Не указано"}
                </div>
                {daysLeft !== null && daysLeft >= 0 && (
                  <Link href="/settings" className="text-xs text-[rgb(var(--primary))] hover:underline">
                    {profile.exam_date ? new Date(profile.exam_date).toLocaleDateString("ru-RU") : "Указать дату"}
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                <Flame className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">Рекомендация AI</div>
                <div className="font-semibold text-[rgb(var(--foreground))]">
                  Фокус: {SKILL_META[plan[0]?.skill === "mixed" ? "reading" : (plan[0]?.skill ?? "reading")].label}
                </div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">Самый слабый скилл</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Skills snapshot */}
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold text-[rgb(var(--foreground))] mb-4">Текущий уровень по скиллам</h2>
            <div className="flex flex-col gap-3">
              {skills.map((s) => {
                const pct = s.band ? (s.band / 9) * 100 : 0;
                const gapToTarget = targetBand - (s.band || 0);
                return (
                  <div key={s.key}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <s.icon className={cn("w-4 h-4", s.color)} />
                      <span className="text-sm font-medium text-[rgb(var(--foreground))]">{s.label}</span>
                      <span className="font-mono text-sm text-[rgb(var(--foreground))] ml-auto">
                        {s.band ? s.band.toFixed(1) : "—"}
                      </span>
                      {s.band > 0 && gapToTarget > 0 && (
                        <span className="text-xs text-[rgb(var(--muted-foreground))] w-12 text-right">
                          +{gapToTarget.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* AI Plan generator */}
        <Card className="border-violet-200 bg-gradient-to-br from-violet-50/50 to-blue-50/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-violet-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-[rgb(var(--foreground))] mb-1">AI план на 14 дней</h3>
                <p className="text-sm text-[rgb(var(--muted-foreground))] mb-3">
                  GPT-4 проанализирует твой текущий уровень, цель и дату экзамена, и сгенерит детальный план с конкретными типами упражнений.
                </p>
                {aiError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">
                    {aiError}
                  </div>
                )}
                {!aiPlan && !isPro && (
                  <PaymentChoiceButton size="sm" />
                )}
                {!aiPlan && isPro && (
                  <Button onClick={generateAIPlan} disabled={aiLoading} size="sm">
                    {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Генерируем...</> : <><Sparkles className="w-4 h-4 mr-2" />Сгенерировать план</>}
                  </Button>
                )}
                {aiPlan && (
                  <div className="flex flex-col gap-4 mt-2">
                    <div className="bg-white border border-violet-200 rounded-xl p-4">
                      <div className="text-xs font-medium text-violet-700 mb-2">СТРАТЕГИЯ</div>
                      <p className="text-sm text-[rgb(var(--foreground))] leading-relaxed">{aiPlan.overall_strategy}</p>
                      {aiPlan.focus_skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {aiPlan.focus_skills.map((s) => (
                            <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {aiPlan.days.map((d) => {
                        const meta = SKILL_META[d.skill] ?? SKILL_META.reading;
                        return (
                          <div key={d.day} className="bg-white border border-[rgb(var(--border))] rounded-lg p-3 flex gap-3">
                            <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0", meta.bg)}>
                              <meta.icon className={cn("w-4 h-4", meta.color)} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-medium text-[rgb(var(--muted-foreground))]">День {d.day}</span>
                                <span className="text-[10px] text-[rgb(var(--muted-foreground))]">·</span>
                                <span className="text-[10px] text-[rgb(var(--muted-foreground))]">{d.duration_min} мин</span>
                              </div>
                              <p className="text-xs font-medium text-[rgb(var(--foreground))] truncate">{d.title}</p>
                              <p className="text-[11px] text-[rgb(var(--primary))] mt-0.5 truncate">{d.focus_area}</p>
                              <p className="text-[11px] text-[rgb(var(--muted-foreground))] mt-1 line-clamp-2">{d.exercise_suggestion}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Button variant="outline" size="sm" onClick={generateAIPlan} disabled={aiLoading} className="self-start">
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Перегенерировать
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 7-day plan (basic, template-based) */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="font-semibold text-[rgb(var(--foreground))]">Базовый план на неделю</h2>
              <span className="ml-auto text-xs text-[rgb(var(--muted-foreground))]">шаблон</span>
            </div>

            <div className="flex flex-col gap-2">
              {plan.map((task, i) => {
                const meta = SKILL_META[task.skill];
                const locked = !isPro && task.skill === "mixed";
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border transition-colors",
                      locked
                        ? "bg-[rgb(var(--muted)/0.05)] border-[rgb(var(--border))] opacity-60"
                        : "bg-[rgb(var(--surface))] border-[rgb(var(--border))] hover:border-[rgb(var(--primary))]"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", meta.bg)}>
                      <meta.icon className={cn("w-5 h-5", meta.color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground))]">День {task.day}</span>
                        <Badge variant="outline" className="text-[10px] py-0">{meta.label}</Badge>
                      </div>
                      <p className="text-sm font-medium text-[rgb(var(--foreground))] truncate">{task.title}</p>
                      <p className="text-xs text-[rgb(var(--muted-foreground))]">~{task.duration} мин</p>
                    </div>

                    {locked ? (
                      <Lock className="w-4 h-4 text-[rgb(var(--muted))]" />
                    ) : (
                      <Link href={task.href}>
                        <Button size="sm" variant="outline">Начать</Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="border-dashed">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[rgb(var(--primary))]" />
              <h3 className="font-medium text-[rgb(var(--foreground))]">Советы для роста</h3>
            </div>
            <ul className="space-y-2 text-sm text-[rgb(var(--muted-foreground))]">
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />Занимайся каждый день — даже 20 минут лучше, чем 3 часа раз в неделю.</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />Анализируй ошибки в разделе &quot;Прогресс&quot; — там видны слабые типы вопросов.</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />Для Writing/Speaking используй AI-фидбек — это быстрее чем ждать репетитора.</li>
              {daysLeft !== null && daysLeft < 30 && daysLeft >= 0 && (
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" /><strong>До экзамена меньше месяца</strong> — пройди диагностику ещё раз и сравни прогресс.</li>
              )}
            </ul>
          </CardContent>
        </Card>

      </div>
    </AppShell>
  );
}
