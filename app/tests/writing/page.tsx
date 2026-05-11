"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  PenLine,
  Clock,
  Zap,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Lock,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNextWriting } from "@/lib/supabase/queries";
import type { Database } from "@/lib/supabase/types";

type WritingTask = Database["public"]["Tables"]["writing_tasks"]["Row"];

// ─── Feedback types ────────────────────────────────────────────────────────────

interface CriterionResult {
  band: number;
  comment: string;
}

interface WritingFeedback {
  overall_band: number;
  criteria: {
    task_achievement: CriterionResult;
    coherence_cohesion: CriterionResult;
    lexical_resource: CriterionResult;
    grammatical_range: CriterionResult;
  };
  summary: string;
  strengths: string[];
  improvements: Array<{ issue: string; example: string; suggestion: string }>;
  corrected_intro?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CriteriaBar({ band, label }: { band: number; label: string }) {
  const pct = ((band - 1) / 8) * 100;
  const color = band >= 7 ? "bg-[rgb(var(--band-high))]" : band >= 5.5 ? "bg-[rgb(var(--band-mid))]" : "bg-[rgb(var(--band-low))]";
  const textColor = band >= 7 ? "text-[rgb(var(--band-high))]" : band >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[rgb(var(--muted-foreground))] w-8 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-[rgb(var(--surface-elevated))] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("text-sm font-mono font-bold w-8 text-right", textColor)}>{band.toFixed(1)}</span>
    </div>
  );
}

// ─── Fallback task (shown while loading or if no DB) ──────────────────────────

const FALLBACK_TASK: WritingTask = {
  id: "fallback",
  source: "local",
  task_type: "task2",
  exam_type: "academic",
  prompt_text: `Some people believe that the best way to improve public health is for governments to invest more money in developing better medical treatments. Others believe that it is better to focus on promoting healthier lifestyles to prevent illness.

Discuss both views and give your own opinion.

Give reasons for your answer and include any relevant examples from your own knowledge or experience.`,
  image_url: null,
  sample_answer: null,
  min_words: 250,
  external_id: null,
  created_at: "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WritingTestPage() {
  const [task, setTask] = useState<WritingTask>(FALLBACK_TASK);
  const [taskLoading, setTaskLoading] = useState(true);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"write" | "loading" | "feedback">("write");
  const [loadingText, setLoadingText] = useState("");
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [timerSec, setTimerSec] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadingRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const minWords = task.min_words ?? 250;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isUnderMin = wordCount < minWords;
  const wordCountColor = wordCount >= minWords ? "text-[rgb(var(--success))]"
    : wordCount >= minWords * 0.8 ? "text-[rgb(var(--warning))]"
    : "text-[rgb(var(--muted-foreground))]";
  const taskTypeLabel = task.task_type === "task1" ? "Task 1" : "Task 2";

  // ── Load task from Supabase ──
  useEffect(() => {
    async function loadTask() {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { setTaskLoading(false); return; }
        const next = await getNextWriting(sb, user.id);
        if (next) setTask(next);
      } catch { /* use fallback */ }
      finally { setTaskLoading(false); }
    }
    loadTask();
  }, []);

  // ── Timer (counts up) ──
  useEffect(() => {
    if (phase === "write") {
      timerRef.current = setInterval(() => setTimerSec((s) => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Submit: call AI API ──
  async function handleSubmit() {
    if (isUnderMin) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("loading");
    setError(null);

    const dots = [
      "Анализируем ответ.",
      "Анализируем ответ..",
      "Анализируем ответ...",
      "Оцениваем по критериям IELTS.",
      "Оцениваем по критериям IELTS..",
      "Генерируем фидбек...",
    ];
    let i = 0;
    setLoadingText(dots[0]);
    loadingRef.current = setInterval(() => {
      i = (i + 1) % dots.length;
      setLoadingText(dots[i]);
    }, 700);

    try {
      const res = await fetch("/api/ai/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          essay: text,
          prompt: task.prompt_text,
          taskType: task.task_type,
          contentId: task.id !== "fallback" ? task.id : null,
        }),
      });

      if (loadingRef.current) clearInterval(loadingRef.current);

      if (res.status === 429) {
        setShowPaywall(true);
        setPhase("write");
        return;
      }
      if (!res.ok) throw new Error(`API error ${res.status}`);

      const parsed: WritingFeedback = await res.json();
      setFeedback(parsed);
      setPhase("feedback");
    } catch (err) {
      if (loadingRef.current) clearInterval(loadingRef.current);
      setError("Не удалось получить фидбек. Проверьте интернет и попробуйте снова.");
      setPhase("write");
    }
  }

  // ── Paywall overlay ──
  if (showPaywall) {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-[rgb(var(--primary)/0.1)] flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-[rgb(var(--primary))]" />
          </div>
          <h2 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-2">AI Writing Feedback</h2>
          <p className="text-[rgb(var(--muted-foreground))] mb-6 text-sm leading-relaxed">
            Получи оценку по всем 4 критериям IELTS с конкретными улучшениями от Claude AI.
          </p>
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5 mb-6 text-left flex flex-col gap-3">
            {["Оценка по 4 критериям (TA, CC, LR, GRA)", "Конкретные улучшения с цитатами", "Безлимитные попытки", "История всех эссе"].map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-[rgb(var(--foreground))]">
                <CheckCircle2 className="w-4 h-4 text-[rgb(var(--success))] shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <Button size="lg" className="w-full mb-3" asChild>
            <Link href="/pricing">Получить Pro — от $4/мес</Link>
          </Button>
          <Button size="lg" variant="ghost" className="w-full text-[rgb(var(--muted-foreground))]" onClick={() => setShowPaywall(false)}>
            Вернуться к эссе
          </Button>
        </div>
      </div>
    );
  }

  // ── Feedback phase ──
  if (phase === "feedback" && feedback) {
    const overall = feedback.overall_band;
    const overallColor = overall >= 7 ? "text-[rgb(var(--band-high))]" : overall >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]";
    const overallBorder = overall >= 7 ? "border-[rgb(var(--band-high))]" : overall >= 5.5 ? "border-[rgb(var(--band-mid))]" : "border-[rgb(var(--band-low))]";

    const criteriaList = [
      { name: "Task Achievement", code: "TA", ...feedback.criteria.task_achievement },
      { name: "Coherence & Cohesion", code: "CC", ...feedback.criteria.coherence_cohesion },
      { name: "Lexical Resource", code: "LR", ...feedback.criteria.lexical_resource },
      { name: "Grammatical Range & Accuracy", code: "GRA", ...feedback.criteria.grammatical_range },
    ];

    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col">
        <header className="sticky top-0 z-40 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
              <ChevronLeft className="w-4 h-4" />Dashboard
            </Link>
            <div className="flex items-center gap-2 ml-2">
              <Sparkles className="w-4 h-4 text-[rgb(var(--primary))]" />
              <span className="font-medium text-sm text-[rgb(var(--foreground))]">AI Feedback</span>
            </div>
          </div>
        </header>

        <div className="max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
          {/* Overall score */}
          <div className="flex flex-col sm:flex-row items-center gap-6 bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
            <div className={cn("w-24 h-24 rounded-full border-4 flex items-center justify-center shrink-0", overallBorder)}>
              <span className={cn("font-mono text-3xl font-bold", overallColor)}>{overall.toFixed(1)}</span>
            </div>
            <div className="flex-1 w-full">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-[rgb(var(--foreground))]">Writing {taskTypeLabel}</span>
                <Badge variant="default">AI оценка</Badge>
              </div>
              <p className="text-sm text-[rgb(var(--muted-foreground))] mb-3">{feedback.summary}</p>
              <div className="flex flex-col gap-2">
                {criteriaList.map((c) => <CriteriaBar key={c.code} band={c.band} label={c.code} />)}
              </div>
            </div>
          </div>

          {/* Strengths */}
          {feedback.strengths.length > 0 && (
            <div className="bg-[rgb(var(--success)/0.06)] border border-[rgb(var(--success)/0.2)] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-[rgb(var(--success))]" />
                <span className="font-semibold text-sm text-[rgb(var(--foreground))]">Сильные стороны</span>
              </div>
              <ul className="flex flex-col gap-2">
                {feedback.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-[rgb(var(--foreground))]">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[rgb(var(--success))] mt-2" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Criteria detail */}
          <div className="flex flex-col gap-4">
            {criteriaList.map((c) => {
              const bandColor = c.band >= 7 ? "text-[rgb(var(--band-high))]" : c.band >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]";
              const bgColor = c.band >= 7 ? "bg-[rgb(var(--band-high)/0.06)] border-[rgb(var(--band-high)/0.2)]"
                : c.band >= 5.5 ? "bg-[rgb(var(--band-mid)/0.06)] border-[rgb(var(--band-mid)/0.2)]"
                : "bg-[rgb(var(--band-low)/0.06)] border-[rgb(var(--band-low)/0.2)]";
              return (
                <div key={c.code} className={cn("rounded-xl border p-4 flex gap-4", bgColor)}>
                  <div className="shrink-0 text-center">
                    <div className={cn("font-mono text-xl font-bold", bandColor)}>{c.band.toFixed(1)}</div>
                    <div className="text-[10px] text-[rgb(var(--muted-foreground))] font-medium mt-0.5">{c.code}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[rgb(var(--foreground))] mb-1">{c.name}</div>
                    <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed">{c.comment}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Improvements */}
          <div className="bg-[rgb(var(--primary)/0.06)] border border-[rgb(var(--primary)/0.15)] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[rgb(var(--primary))]" />
              <span className="font-semibold text-sm text-[rgb(var(--foreground))]">Что улучшить</span>
            </div>
            <ol className="flex flex-col gap-4">
              {feedback.improvements.map((imp, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[rgb(var(--primary)/0.15)] text-[rgb(var(--primary))] text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-[rgb(var(--foreground))] mb-0.5">{imp.issue}</p>
                    {imp.example && (
                      <p className="text-[rgb(var(--muted-foreground))] italic text-xs mb-1">«{imp.example}»</p>
                    )}
                    <p className="text-[rgb(var(--foreground))]">{imp.suggestion}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Corrected intro */}
          {feedback.corrected_intro && (
            <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <PenLine className="w-4 h-4 text-teal-500" />
                <span className="font-semibold text-sm text-[rgb(var(--foreground))]">Улучшенное вступление</span>
              </div>
              <p className="text-sm text-[rgb(var(--foreground))] leading-relaxed italic">{feedback.corrected_intro}</p>
            </div>
          )}

          {/* Your essay */}
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm text-[rgb(var(--foreground))]">Ваш ответ</span>
              <span className="text-xs text-[rgb(var(--muted-foreground))]">{wordCount} слов</span>
            </div>
            <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">{text}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => { setFeedback(null); setPhase("write"); setText(""); }}>
              <RotateCcw className="w-4 h-4" />
              Новое задание
            </Button>
            <Button variant="outline" className="flex-1 gap-2" onClick={() => { setPhase("write"); }}>
              <PenLine className="w-4 h-4" />
              Переписать
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading phase ──
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[rgb(var(--primary)/0.1)] flex items-center justify-center mx-auto mb-5">
            <Loader2 className="w-8 h-8 text-[rgb(var(--primary))] animate-spin" />
          </div>
          <p className="text-[rgb(var(--foreground))] font-medium">{loadingText}</p>
          <p className="text-xs text-[rgb(var(--muted-foreground))] mt-2">Claude Sonnet · ~15 секунд</p>
        </div>
      </div>
    );
  }

  // ── Write phase ──
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[rgb(var(--background))]">
      <header className="shrink-0 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))] z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] shrink-0">
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <PenLine className="w-3.5 h-3.5 text-teal-500 shrink-0" />
            <span className="text-sm font-medium text-[rgb(var(--foreground))] truncate">
              Writing {taskTypeLabel}
              {taskLoading && <span className="text-[rgb(var(--muted-foreground))]"> · загрузка...</span>}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-mono text-[rgb(var(--foreground))] shrink-0">
            <Clock className="w-3.5 h-3.5 text-[rgb(var(--warning))]" />
            {mmss(timerSec)}
          </div>
          <Button size="sm" disabled={isUnderMin} onClick={handleSubmit} className="shrink-0 gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Feedback</span>
          </Button>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 text-center">
          {error}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Prompt */}
        <div className="w-2/5 hidden md:flex flex-col border-r border-[rgb(var(--border))] overflow-y-auto p-6">
          <Badge variant="outline" className="mb-4 self-start">
            {taskTypeLabel} · мин. {minWords} слов
          </Badge>
          <p className="text-sm text-[rgb(var(--foreground))] leading-relaxed whitespace-pre-line">
            {task.prompt_text}
          </p>
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="md:hidden shrink-0 bg-[rgb(var(--surface-elevated))] border-b border-[rgb(var(--border))] px-4 py-2">
            <details>
              <summary className="text-xs text-[rgb(var(--primary))] font-medium cursor-pointer">Показать задание</summary>
              <p className="text-xs text-[rgb(var(--foreground))] mt-2 leading-relaxed whitespace-pre-line">{task.prompt_text}</p>
            </details>
          </div>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Начните писать эссе здесь..."
            className={cn(
              "flex-1 w-full resize-none p-6 bg-transparent text-[rgb(var(--foreground))] text-[15px] leading-relaxed",
              "placeholder:text-[rgb(var(--muted))] focus:outline-none"
            )}
            autoFocus
          />

          <div className="shrink-0 border-t border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={cn("text-sm font-mono font-semibold tabular-nums", wordCountColor)}>
                {wordCount} слов
              </span>
              {isUnderMin ? (
                <span className="flex items-center gap-1 text-xs text-[rgb(var(--muted-foreground))]">
                  <AlertCircle className="w-3.5 h-3.5 text-[rgb(var(--warning))]" />
                  ещё {minWords - wordCount}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-[rgb(var(--success))]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Минимум достигнут
                </span>
              )}
            </div>
            <Button size="sm" disabled={isUnderMin} onClick={handleSubmit} className="gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Получить AI Feedback
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
