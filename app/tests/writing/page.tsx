"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  ChevronDown,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNextWriting, getWritingTask } from "@/lib/supabase/queries";
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

type GeneratedTask1Visual =
  | { kind: "table"; title: string; description: string; headers: string[]; rows: Array<{ label: string; values: number[] }> }
  | { kind: "bar"; title: string; description: string; unit: string; bars: Array<{ label: string; value: number }> }
  | { kind: "line"; title: string; description: string; unit: string; years: string[]; series: Array<{ label: string; values: number[] }> }
  | { kind: "pie"; title: string; description: string; pies: Array<{ label: string; slices: Array<{ label: string; value: number }> }> }
  | { kind: "process"; title: string; description: string; steps: string[] }
  | { kind: "map"; title: string; description: string; before: string[]; after: string[] };

function hashPrompt(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function generatedValue(seed: number, index: number, min: number, max: number) {
  const span = max - min + 1;
  return min + ((seed + index * 37 + Math.floor(index / 2) * 19) % span);
}

function detectTask1VisualKind(prompt: string): GeneratedTask1Visual["kind"] | null {
  const lower = prompt.toLowerCase();
  if (lower.includes("write a letter")) return null;
  if (lower.includes("map") || lower.includes("maps")) return "map";
  if (lower.includes("process") || lower.includes("diagram") || lower.includes("steps involved")) return "process";
  if (lower.includes("table")) return "table";
  if (lower.includes("line chart") || lower.includes("line graph")) return "line";
  if (lower.includes("pie chart")) return "pie";
  if (lower.includes("bar chart") || lower.includes("chart") || lower.includes("graph")) return "bar";
  return null;
}

function buildGeneratedTask1Visual(prompt: string): GeneratedTask1Visual | null {
  const kind = detectTask1VisualKind(prompt);
  if (!kind) return null;

  const seed = hashPrompt(prompt);
  const lower = prompt.toLowerCase();
  const title = prompt.split(".")[0]?.replace(/^the\s+/i, "The ") || "Task 1 visual";

  if (kind === "table") {
    const ageHeaders = ["15-24", "25-34", "35-44", "45-54", "55+"];
    const defaultHeaders = ["2015", "2017", "2019", "2021", "2022"];
    const headers = lower.includes("age") ? ageHeaders : defaultHeaders;
    const rows = lower.includes("six countries")
      ? ["Japan", "Germany", "Brazil", "Mexico", "Egypt", "India"]
      : ["Country A", "Country B", "Country C", "Country D", "Country E", "Country F"];
    const tableRows = rows.map((label, rowIndex) => ({
      label,
      values: headers.map((_, colIndex) => {
        const base = lower.includes("literacy") ? 68 + rowIndex * 4 : 20 + rowIndex * 7;
        return Math.min(99, base + generatedValue(seed, rowIndex + colIndex, 0, 12) - colIndex * 2);
      }),
    }));
    const description = [
      `${title}.`,
      `Unit: percentages.`,
      `Columns: ${headers.join(", ")}.`,
      ...tableRows.map((row) => `${row.label}: ${row.values.join(", ")}.`),
    ].join("\n");
    return { kind, title, headers, rows: tableRows, description };
  }

  if (kind === "line") {
    const years = ["2000", "2005", "2010", "2015", "2020", "2022"];
    const series = ["New York", "Tokyo", "London"].map((label, seriesIndex) => ({
      label,
      values: years.map((_, yearIndex) => generatedValue(seed, seriesIndex * 10 + yearIndex, 18 + seriesIndex * 6, 62 + seriesIndex * 8)),
    }));
    const description = [
      `${title}.`,
      `Unit: index values.`,
      `Years: ${years.join(", ")}.`,
      ...series.map((item) => `${item.label}: ${item.values.join(", ")}.`),
    ].join("\n");
    return { kind, title, unit: "index", years, series, description };
  }

  if (kind === "pie") {
    const labels = lower.includes("energy")
      ? ["Coal", "Natural gas", "Nuclear", "Renewables", "Oil"]
      : ["Category A", "Category B", "Category C", "Category D", "Other"];
    const makeSlices = (offset: number) => {
      const raw = labels.map((label, index) => ({ label, value: generatedValue(seed, offset + index, 8, 34) }));
      const total = raw.reduce((sum, item) => sum + item.value, 0);
      let remaining = 100;
      return raw.map((item, index) => {
        const value = index === raw.length - 1 ? remaining : Math.max(5, Math.round((item.value / total) * 100));
        remaining -= value;
        return { ...item, value: Math.max(0, value) };
      });
    };
    const pies = [
      { label: "2000", slices: makeSlices(0) },
      { label: "2020", slices: makeSlices(20) },
    ];
    const description = [
      `${title}.`,
      ...pies.map((pie) => `${pie.label}: ${pie.slices.map((slice) => `${slice.label} ${slice.value}%`).join(", ")}.`),
    ].join("\n");
    return { kind, title, pies, description };
  }

  if (kind === "process") {
    const steps = lower.includes("recycling")
      ? ["Collection", "Sorting", "Cleaning", "Melting", "Moulding", "New product"]
      : ["Raw materials", "Preparation", "Processing", "Quality check", "Packaging", "Distribution"];
    return {
      kind,
      title,
      steps,
      description: `${title}.\nProcess stages: ${steps.join(" -> ")}.`,
    };
  }

  if (kind === "map") {
    const before = ["Small harbour", "Residential area", "Farmland", "Local road", "Village centre"];
    const after = ["Marina", "Apartments", "Shopping area", "Main road", "Tourist facilities"];
    return {
      kind,
      title,
      before,
      after,
      description: `${title}.\nBefore: ${before.join(", ")}.\nAfter: ${after.join(", ")}.`,
    };
  }

  const labels = lower.includes("countries")
    ? ["USA", "Germany", "China", "Japan", "Brazil"]
    : ["Category A", "Category B", "Category C", "Category D", "Category E"];
  const bars = labels.map((label, index) => ({ label, value: generatedValue(seed, index, 18, 88) }));
  const description = [
    `${title}.`,
    `Unit: percentages.`,
    ...bars.map((bar) => `${bar.label}: ${bar.value}%.`),
  ].join("\n");
  return { kind: "bar", title, unit: "%", bars, description };
}

function taskPromptWithGeneratedVisual(task: WritingTask) {
  if (task.task_type !== "task1" || task.image_url) return task.prompt_text;
  const visual = buildGeneratedTask1Visual(task.prompt_text);
  if (!visual) return task.prompt_text;
  return `${task.prompt_text}\n\nVISUAL DATA SHOWN TO THE STUDENT:\n${visual.description}`;
}

function visiblePromptText(prompt: string, hasGeneratedVisual: boolean) {
  if (!hasGeneratedVisual) return prompt;
  return prompt
    .replace(/^the\s+[^.]*?(?:chart|graph|table|diagram|map|process)[^.]*?\.\s*/i, "")
    .trim();
}

function GeneratedTask1VisualCard({ visual }: { visual: GeneratedTask1Visual }) {
  return (
    <div className="mb-4 rounded-xl border border-[rgb(var(--border))] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--muted-foreground))]">
            Generated Task 1 visual
          </div>
          <h3 className="mt-1 text-sm font-semibold text-[rgb(var(--foreground))]">{visual.title}</h3>
        </div>
        <Badge variant="outline" className="shrink-0 capitalize">{visual.kind}</Badge>
      </div>

      {visual.kind === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-[rgb(var(--border))] bg-[rgb(var(--surface-elevated))] px-2 py-2 text-left">Country</th>
                {visual.headers.map((header) => (
                  <th key={header} className="border border-[rgb(var(--border))] bg-[rgb(var(--surface-elevated))] px-2 py-2 text-right">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visual.rows.map((row) => (
                <tr key={row.label}>
                  <td className="border border-[rgb(var(--border))] px-2 py-2 font-medium">{row.label}</td>
                  {row.values.map((value, index) => (
                    <td key={`${row.label}-${index}`} className="border border-[rgb(var(--border))] px-2 py-2 text-right">{value}%</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visual.kind === "bar" && (
        <div className="space-y-2">
          {visual.bars.map((bar) => (
            <div key={bar.label} className="grid grid-cols-[72px_1fr_42px] items-center gap-2 text-xs">
              <span className="truncate text-[rgb(var(--muted-foreground))]">{bar.label}</span>
              <div className="h-6 rounded-md bg-[rgb(var(--surface-elevated))]">
                <div className="h-full rounded-md bg-blue-500" style={{ width: `${bar.value}%` }} />
              </div>
              <span className="text-right font-mono">{bar.value}{visual.unit}</span>
            </div>
          ))}
        </div>
      )}

      {visual.kind === "line" && (
        <div className="space-y-3">
          <div className="grid grid-cols-6 gap-1 text-[10px] text-[rgb(var(--muted-foreground))]">
            {visual.years.map((year) => <span key={year}>{year}</span>)}
          </div>
          {visual.series.map((series) => (
            <div key={series.label}>
              <div className="mb-1 text-xs font-medium">{series.label}</div>
              <div className="flex h-24 items-end gap-1 rounded-lg bg-[rgb(var(--surface-elevated))] p-2">
                {series.values.map((value, index) => (
                  <div key={`${series.label}-${index}`} className="flex-1 rounded-t bg-violet-500" style={{ height: `${Math.max(10, value)}%` }} title={`${visual.years[index]}: ${value}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {visual.kind === "pie" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {visual.pies.map((pie) => (
            <div key={pie.label} className="rounded-lg bg-[rgb(var(--surface-elevated))] p-3">
              <div className="mb-2 text-xs font-semibold">{pie.label}</div>
              <div className="space-y-1">
                {pie.slices.map((slice) => (
                  <div key={slice.label} className="flex items-center justify-between gap-2 text-xs">
                    <span>{slice.label}</span>
                    <span className="font-mono">{slice.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {visual.kind === "process" && (
        <div className="flex flex-wrap items-center gap-2">
          {visual.steps.map((step, index) => (
            <div key={step} className="flex items-center gap-2">
              <span className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-elevated))] px-3 py-2 text-xs font-medium">{step}</span>
              {index < visual.steps.length - 1 && <ChevronRight className="h-4 w-4 text-[rgb(var(--muted-foreground))]" />}
            </div>
          ))}
        </div>
      )}

      {visual.kind === "map" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[["Before", visual.before], ["After", visual.after]].map(([label, items]) => (
            <div key={label as string} className="rounded-lg bg-[rgb(var(--surface-elevated))] p-3">
              <div className="mb-2 text-xs font-semibold">{label as string}</div>
              <ul className="space-y-1 text-xs">
                {(items as string[]).map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
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

function WritingTestPageContent() {
  const searchParams = useSearchParams();
  const selectedTaskId = searchParams.get("id");
  // ── Mode: "full" = both tasks, "single" = practice one task ──
  const [mode, setMode] = useState<"full" | "single">("single");
  const [activeTab, setActiveTab] = useState<"task1" | "task2">("task1");

  // ── Single-mode state (practice one task) ──
  const [task, setTask] = useState<WritingTask>(FALLBACK_TASK);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);

  // ── Full-mode state (both tasks) ──
  const [task1, setTask1] = useState<WritingTask | null>(null);
  const [task2, setTask2] = useState<WritingTask>(FALLBACK_TASK);
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [feedback1, setFeedback1] = useState<WritingFeedback | null>(null);
  const [feedback2, setFeedback2] = useState<WritingFeedback | null>(null);

  // ── Shared state ──
  const [taskLoading, setTaskLoading] = useState(true);
  const [phase, setPhase] = useState<"intro" | "write" | "loading" | "feedback">("intro");
  const [preferredTaskType, setPreferredTaskType] = useState<"task1" | "task2" | null>(null);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const WRITING_TOTAL_SECONDS = 60 * 60;
  const [timeLeft, setTimeLeft] = useState(WRITING_TOTAL_SECONDS);
  const [showSample, setShowSample] = useState(false);
  const autoSubmittedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadingRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Derived values that adapt to mode ──
  const activeTask = mode === "full"
    ? (activeTab === "task1" ? task1 : task2)
    : task;
  const activeText = mode === "full"
    ? (activeTab === "task1" ? text1 : text2)
    : text;
  const setActiveText = mode === "full"
    ? (activeTab === "task1" ? setText1 : setText2)
    : setText;

  const minWords = activeTask?.min_words ?? (activeTab === "task1" ? 150 : 250);
  const wordCount = activeText.trim() ? activeText.trim().split(/\s+/).length : 0;
  const isUnderMin = wordCount < minWords;
  const wordCountColor = wordCount >= minWords ? "text-[rgb(var(--success))]"
    : wordCount >= minWords * 0.8 ? "text-[rgb(var(--warning))]"
    : "text-[rgb(var(--muted-foreground))]";
  const taskTypeLabel = activeTask?.task_type === "task1" ? "Task 1" : "Task 2";

  // Full-mode word counts for tab badges
  const wordCount1 = text1.trim() ? text1.trim().split(/\s+/).length : 0;
  const wordCount2 = text2.trim() ? text2.trim().split(/\s+/).length : 0;
  const canSubmitFull = wordCount2 >= (task2.min_words ?? 250);

  // ── Load task(s) from Supabase ──
  useEffect(() => {
    if (phase !== "write") return;
    async function loadTask() {
      try {
        setTaskLoading(true);
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { setTaskLoading(false); return; }

        if (mode === "full") {
          const [t1, t2] = await Promise.all([
            getNextWriting(sb, user.id, "task1"),
            getNextWriting(sb, user.id, "task2"),
          ]);
          setTask1(t1);
          if (t2) setTask2(t2);
        } else {
          const next = selectedTaskId
            ? await getWritingTask(sb, selectedTaskId)
            : await getNextWriting(sb, user.id, preferredTaskType ?? undefined);
          if (next) setTask(next);
        }
      } catch { /* use fallback */ }
      finally { setTaskLoading(false); }
    }
    loadTask();
  }, [phase, mode, preferredTaskType, selectedTaskId]);

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Countdown timer with auto-submit at 0 ──
  useEffect(() => {
    if (phase !== "write") return;
    if (timeLeft <= 0) {
      const canAutoSubmit = mode === "full" ? canSubmitFull : !isUnderMin;
      if (!autoSubmittedRef.current && canAutoSubmit) {
        autoSubmittedRef.current = true;
        handleSubmit();
      }
      return;
    }
    timerRef.current = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft]);

  const lowTime = timeLeft < 5 * 60;
  const outOfTime = timeLeft === 0;

  // ── Submit: call AI API ──
  async function handleSubmit() {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("loading");
    setError(null);

    if (loadingRef.current) clearInterval(loadingRef.current);
    let dotIdx = 0;

    function startDots(msgs: string[]) {
      dotIdx = 0;
      setLoadingText(msgs[0]);
      loadingRef.current = setInterval(() => {
        dotIdx = (dotIdx + 1) % msgs.length;
        setLoadingText(msgs[dotIdx]);
      }, 700);
    }

    function stopDots() {
      if (loadingRef.current) { clearInterval(loadingRef.current); loadingRef.current = null; }
    }

    async function submitOne(essay: string, t: WritingTask) {
      return fetch("/api/ai/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          essay,
          prompt: taskPromptWithGeneratedVisual(t),
          taskType: t.task_type,
          contentId: t.id !== "fallback" ? t.id : null,
        }),
      });
    }

    try {
      if (mode === "single") {
        if (isUnderMin) { setPhase("write"); return; }
        startDots(["Анализируем ответ.", "Анализируем ответ..", "Анализируем ответ...", "Оцениваем по критериям IELTS.", "Оцениваем по критериям IELTS..", "Генерируем фидбек..."]);
        const res = await submitOne(text, task);
        stopDots();
        if (res.status === 403 || res.status === 429) { setShowPaywall(true); setPhase("write"); return; }
        if (!res.ok) throw new Error(`API error ${res.status}`);
        setFeedback(await res.json());
        setPhase("feedback");
      } else {
        // Full mode: submit Task 1 (if available + enough words), then Task 2
        const hasTask1 = task1 && wordCount1 >= (task1.min_words ?? 150);
        if (!canSubmitFull) { setPhase("write"); return; }

        if (hasTask1 && task1) {
          startDots(["Оцениваем Task 1.", "Оцениваем Task 1..", "Оцениваем Task 1..."]);
          const res1 = await submitOne(text1, task1);
          stopDots();
          if (res1.status === 403 || res1.status === 429) { setShowPaywall(true); setPhase("write"); return; }
          if (res1.ok) {
            setFeedback1(await res1.json());
          }
        }

        startDots(["Оцениваем Task 2.", "Оцениваем Task 2..", "Оцениваем Task 2...", "Генерируем фидбек..."]);
        const res2 = await submitOne(text2, task2);
        stopDots();
        if (res2.status === 403 || res2.status === 429) {
          setShowPaywall(true);
          if (!feedback1) { setPhase("write"); return; }
          setPhase("feedback");
          return;
        }
        if (!res2.ok) throw new Error(`API error ${res2.status}`);
        setFeedback2(await res2.json());
        setPhase("feedback");
      }
    } catch {
      stopDots();
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
            AI-разбор доступен только по подписке. Купите Pro, чтобы получить оценку по 4 критериям IELTS и конкретные улучшения.
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

  // ── Render one task's feedback block ──
  function renderTaskFeedback(fb: WritingFeedback, taskLabel: string, essayText: string, essayWordCount: number, sampleAnswer?: string | null) {
    const overall = fb.overall_band;
    const overallColor = overall >= 7 ? "text-[rgb(var(--band-high))]" : overall >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]";
    const overallBorder = overall >= 7 ? "border-[rgb(var(--band-high))]" : overall >= 5.5 ? "border-[rgb(var(--band-mid))]" : "border-[rgb(var(--band-low))]";
    const criteriaList = [
      { name: "Task Achievement", code: "TA", ...fb.criteria.task_achievement },
      { name: "Coherence & Cohesion", code: "CC", ...fb.criteria.coherence_cohesion },
      { name: "Lexical Resource", code: "LR", ...fb.criteria.lexical_resource },
      { name: "Grammatical Range & Accuracy", code: "GRA", ...fb.criteria.grammatical_range },
    ];

    return (
      <>
        {/* Overall score */}
        <div className="flex flex-col sm:flex-row items-center gap-6 bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
          <div className={cn("w-24 h-24 rounded-full border-4 flex items-center justify-center shrink-0", overallBorder)}>
            <span className={cn("font-mono text-3xl font-bold", overallColor)}>{overall.toFixed(1)}</span>
          </div>
          <div className="flex-1 w-full">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-[rgb(var(--foreground))]">Writing {taskLabel}</span>
              <Badge variant="default">AI оценка</Badge>
            </div>
            <p className="text-sm text-[rgb(var(--muted-foreground))] mb-3">{fb.summary}</p>
            <div className="flex flex-col gap-2">
              {criteriaList.map((c) => <CriteriaBar key={c.code} band={c.band} label={c.code} />)}
            </div>
          </div>
        </div>

        {/* Strengths */}
        {fb.strengths.length > 0 && (
          <div className="bg-[rgb(var(--success)/0.06)] border border-[rgb(var(--success)/0.2)] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-[rgb(var(--success))]" />
              <span className="font-semibold text-sm text-[rgb(var(--foreground))]">Сильные стороны</span>
            </div>
            <ul className="flex flex-col gap-2">
              {fb.strengths.map((s, i) => (
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
            {fb.improvements.map((imp, i) => (
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
        {fb.corrected_intro && (
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <PenLine className="w-4 h-4 text-teal-500" />
              <span className="font-semibold text-sm text-[rgb(var(--foreground))]">Улучшенное вступление</span>
            </div>
            <p className="text-sm text-[rgb(var(--foreground))] leading-relaxed italic">{fb.corrected_intro}</p>
          </div>
        )}

        {/* Your essay */}
        <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm text-[rgb(var(--foreground))]">Ваш ответ</span>
            <span className="text-xs text-[rgb(var(--muted-foreground))]">{essayWordCount} слов</span>
          </div>
          <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">{essayText}</p>
        </div>

        {/* Sample answer (Band 8+) */}
        {sampleAnswer && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
            <button
              onClick={() => setShowSample((v) => !v)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="font-semibold text-sm text-[rgb(var(--foreground))]">Образец ответа Band 8+</span>
                <Badge variant="secondary" className="text-[10px]">Эталон</Badge>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-[rgb(var(--muted-foreground))] transition-transform", showSample && "rotate-180")} />
            </button>
            {showSample && (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <p className="text-sm text-[rgb(var(--foreground))] leading-relaxed whitespace-pre-wrap">{sampleAnswer}</p>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  // ── Feedback phase ──
  if (phase === "feedback" && (feedback || feedback1 || feedback2)) {
    // Compute combined overall band for full mode
    const combinedBand = mode === "full"
      ? (feedback1 && feedback2
        ? Math.round(((feedback1.overall_band + feedback2.overall_band * 2) / 3) * 2) / 2
        : feedback2?.overall_band ?? feedback1?.overall_band ?? 0)
      : (feedback?.overall_band ?? 0);

    const combinedColor = combinedBand >= 7 ? "text-[rgb(var(--band-high))]" : combinedBand >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]";
    const combinedBorder = combinedBand >= 7 ? "border-[rgb(var(--band-high))]" : combinedBand >= 5.5 ? "border-[rgb(var(--band-mid))]" : "border-[rgb(var(--band-low))]";

    function handleNewTask() {
      if (mode === "full") {
        setFeedback1(null); setFeedback2(null);
        setText1(""); setText2("");
        setActiveTab("task1");
      } else {
        setFeedback(null); setText("");
      }
      setTimeLeft(WRITING_TOTAL_SECONDS);
      autoSubmittedRef.current = false;
      setPhase("write");
    }

    function handleRewrite() {
      setTimeLeft(WRITING_TOTAL_SECONDS);
      autoSubmittedRef.current = false;
      if (mode === "full") { setActiveTab("task1"); }
      setPhase("write");
    }

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
          {/* Combined overall for full mode */}
          {mode === "full" && (
            <div className="flex flex-col items-center gap-3 bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
              <div className={cn("w-28 h-28 rounded-full border-4 flex items-center justify-center", combinedBorder)}>
                <span className={cn("font-mono text-4xl font-bold", combinedColor)}>{combinedBand.toFixed(1)}</span>
              </div>
              <div className="text-center">
                <span className="font-semibold text-[rgb(var(--foreground))]">Writing — общий балл</span>
                <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">Task 1 + Task 2 (взвешенная оценка)</p>
              </div>
            </div>
          )}

          {/* Single mode feedback */}
          {mode === "single" && feedback && renderTaskFeedback(feedback, taskTypeLabel, text, wordCount, task.sample_answer)}

          {/* Full mode: Task 1 feedback */}
          {mode === "full" && feedback1 && (
            <>
              <h2 className="text-lg font-bold text-[rgb(var(--foreground))] mt-2">Task 1</h2>
              {renderTaskFeedback(feedback1, "Task 1", text1, wordCount1, task1?.sample_answer)}
            </>
          )}

          {/* Full mode: Task 2 feedback */}
          {mode === "full" && feedback2 && (
            <>
              <h2 className="text-lg font-bold text-[rgb(var(--foreground))] mt-4 pt-4 border-t border-[rgb(var(--border))]">Task 2</h2>
              {renderTaskFeedback(feedback2, "Task 2", text2, wordCount2, task2.sample_answer)}
            </>
          )}

          {/* Full mode: note if Task 1 was skipped */}
          {mode === "full" && !feedback1 && (
            <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl p-4 text-sm text-[rgb(var(--muted-foreground))] text-center">
              Task 1 не был оценён — ответ слишком короткий или задание недоступно.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 gap-2" onClick={handleNewTask}>
              <RotateCcw className="w-4 h-4" />
              Новое задание
            </Button>
            <Button variant="outline" className="flex-1 gap-2" onClick={handleRewrite}>
              <PenLine className="w-4 h-4" />
              Переписать
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── INTRO phase: pre-test landing ──
  if (phase === "intro") {
    const examLabel = task.exam_type === "general" ? "General Training" : "Academic";
    return (
      <div className="min-h-screen bg-[rgb(var(--background))]">
        <header className="sticky top-0 z-40 bg-white border-b border-[rgb(var(--border))]">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
              <ChevronLeft className="w-4 h-4" />Dashboard
            </Link>
            <div className="flex items-center gap-2 ml-2">
              <PenLine className="w-4 h-4 text-violet-500" />
              <span className="font-semibold text-[rgb(var(--foreground))]">Writing Test</span>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl border border-[rgb(var(--border))] shadow-sm p-8 flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
              <PenLine className="w-8 h-8 text-violet-500" />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-[rgb(var(--foreground))] mb-2">IELTS {examLabel} Writing</h1>
              <p className="text-sm text-[rgb(var(--muted-foreground))]">
                2 задания: описание графика и эссе
              </p>
            </div>

            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-violet-500">60 мин</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">Время</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-violet-500">2</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">Заданий</div>
              </div>
            </div>

            <div className="text-left w-full">
              <h2 className="font-semibold text-[rgb(var(--foreground))] mb-3">Формат теста</h2>
              <ul className="space-y-2 text-sm text-[rgb(var(--muted-foreground))]">
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>Task 1: Описание визуальной информации (графики, диаграммы) — 150+ слов</li>
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>Task 2: Эссе в ответ на точку зрения или аргумент — 250+ слов</li>
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>Оценка: Task Achievement, Coherence, Vocabulary, Grammar</li>
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>Task 2 оценивается вдвое выше, чем Task 1</li>
              </ul>
            </div>

            <div className="w-full bg-[rgb(var(--muted)/0.05)] rounded-lg px-4 py-2.5 text-xs text-[rgb(var(--muted-foreground))] text-center">
              🌐 Тест проводится полностью на английском языке
            </div>

            <button
              onClick={() => { setMode("full"); setPreferredTaskType(null); setPhase("write"); }}
              className="w-full bg-[rgb(var(--primary))] hover:bg-[rgb(var(--primary)/0.92)] text-white font-semibold py-3.5 px-5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md shadow-[rgb(var(--primary)/0.25)]"
            >
              Начать тест Writing
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="relative w-full flex items-center gap-3">
              <div className="flex-1 h-px bg-[rgb(var(--border))]" />
              <span className="text-[10px] uppercase tracking-widest text-[rgb(var(--muted-foreground))]">Или практикуйте по заданию</span>
              <div className="flex-1 h-px bg-[rgb(var(--border))]" />
            </div>
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                onClick={() => { setMode("single"); setPreferredTaskType("task1"); setPhase("write"); }}
                className="rounded-xl border border-[rgb(var(--border))] hover:border-[rgb(var(--primary)/0.4)] hover:bg-[rgb(var(--primary)/0.03)] py-2.5 px-3 text-sm font-medium text-[rgb(var(--foreground))] transition-all"
              >
                Task 1
              </button>
              <button
                onClick={() => { setMode("single"); setPreferredTaskType("task2"); setPhase("write"); }}
                className="rounded-xl border border-[rgb(var(--border))] hover:border-[rgb(var(--primary)/0.4)] hover:bg-[rgb(var(--primary)/0.03)] py-2.5 px-3 text-sm font-medium text-[rgb(var(--foreground))] transition-all"
              >
                Task 2
              </button>
            </div>
          </div>
        </main>
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
  const submitDisabled = mode === "full" ? !canSubmitFull : isUnderMin;
  const headerLabel = mode === "full" ? "Writing Test" : `Writing ${taskTypeLabel}`;
  const promptText = activeTask?.prompt_text ?? "";
  const promptImage = activeTask?.image_url ?? null;
  const generatedVisual = activeTask?.task_type === "task1" && !promptImage
    ? buildGeneratedTask1Visual(promptText)
    : null;
  const promptTextToShow = visiblePromptText(promptText, Boolean(generatedVisual));
  const task1Unavailable = mode === "full" && !task1 && !taskLoading;

  // Word count color helpers for tab badges
  const wc1Color = wordCount1 >= (task1?.min_words ?? 150) ? "text-[rgb(var(--success))]" : "text-[rgb(var(--muted-foreground))]";
  const wc2Color = wordCount2 >= (task2.min_words ?? 250) ? "text-[rgb(var(--success))]" : "text-[rgb(var(--muted-foreground))]";

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
              {headerLabel}
              {taskLoading && <span className="text-[rgb(var(--muted-foreground))]"> · загрузка...</span>}
            </span>
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 text-sm font-mono shrink-0",
              lowTime ? "text-[rgb(var(--destructive))] font-bold" : "text-[rgb(var(--foreground))]"
            )}
            title="Осталось до конца теста"
          >
            <Clock className={cn("w-3.5 h-3.5", lowTime ? "text-[rgb(var(--destructive))]" : "text-[rgb(var(--warning))]")} />
            {mmss(timeLeft)}
          </div>
          <button
            onClick={() => {
              const params = new URLSearchParams({
                q: `Помоги с Writing ${taskTypeLabel}: "${promptText.slice(0, 300)}". Подскажи структуру ответа, какие linking words использовать, и какие grammar-конструкции покажут Band 7+.`,
              });
              window.open(`/tutor?${params.toString()}`, "_blank");
            }}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors shrink-0"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Спросить ИИ
          </button>
          <Button size="sm" disabled={submitDisabled} onClick={handleSubmit} className="shrink-0 gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Feedback</span>
          </Button>
        </div>
      </header>

      {/* Tab bar for full mode */}
      {mode === "full" && (
        <div className="shrink-0 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))] px-4">
          <div className="max-w-5xl mx-auto flex">
            {(["task1", "task2"] as const).map((tab) => {
              const isActive = activeTab === tab;
              const label = tab === "task1" ? "Task 1" : "Task 2";
              const wc = tab === "task1" ? wordCount1 : wordCount2;
              const wcColor = tab === "task1" ? wc1Color : wc2Color;
              const minW = tab === "task1" ? (task1?.min_words ?? 150) : (task2.min_words ?? 250);
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "relative px-4 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "text-[rgb(var(--primary))]"
                      : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {label}
                    <span className={cn("text-xs font-mono", wcColor)}>{wc}/{minW}</span>
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[rgb(var(--primary))] rounded-t" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 text-center">
          {error}
        </div>
      )}
      {lowTime && !outOfTime && (
        <div className="bg-[rgb(var(--destructive)/0.08)] border-b border-[rgb(var(--destructive)/0.2)] px-4 py-1.5 text-xs text-[rgb(var(--destructive))] text-center font-medium">
          Осталось меньше 5 минут — тест автоматически завершится при 0:00.
        </div>
      )}
      {outOfTime && (
        <div className="bg-[rgb(var(--destructive)/0.12)] border-b border-[rgb(var(--destructive)/0.3)] px-4 py-1.5 text-xs text-[rgb(var(--destructive))] text-center font-semibold">
          Время вышло. {submitDisabled ? "Эссе слишком короткое для AI-оценки — продолжайте писать или сдайте." : "Идёт автоматическая отправка…"}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Prompt */}
        <div className="w-2/5 hidden md:flex flex-col border-r border-[rgb(var(--border))] overflow-y-auto p-6">
          {task1Unavailable && activeTab === "task1" ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <PenLine className="w-8 h-8 text-[rgb(var(--muted-foreground))]" />
              <p className="text-sm text-[rgb(var(--muted-foreground))]">Задания Task 1 скоро будут добавлены.</p>
              <button
                onClick={() => setActiveTab("task2")}
                className="text-sm text-[rgb(var(--primary))] hover:underline font-medium"
              >
                Перейти к Task 2
              </button>
            </div>
          ) : (
            <>
              <Badge variant="outline" className="mb-4 self-start">
                {taskTypeLabel} · мин. {minWords} слов
              </Badge>
              {promptImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={promptImage}
                  alt="Task 1 chart"
                  className="w-full rounded-lg border border-[rgb(var(--border))] mb-4 bg-white"
                />
              )}
              {generatedVisual && <GeneratedTask1VisualCard visual={generatedVisual} />}
              {promptTextToShow && (
                <p className="text-sm text-[rgb(var(--foreground))] leading-relaxed whitespace-pre-line">
                  {promptTextToShow}
                </p>
              )}
            </>
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="md:hidden shrink-0 bg-[rgb(var(--surface-elevated))] border-b border-[rgb(var(--border))] px-4 py-2">
            {task1Unavailable && activeTab === "task1" ? (
              <p className="text-xs text-[rgb(var(--muted-foreground))]">Задания Task 1 скоро будут добавлены. <button onClick={() => setActiveTab("task2")} className="text-[rgb(var(--primary))] hover:underline">Перейти к Task 2</button></p>
            ) : (
              <details>
                <summary className="text-xs text-[rgb(var(--primary))] font-medium cursor-pointer">Показать задание</summary>
                {promptImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={promptImage} alt="Task 1 chart" className="w-full rounded-lg border border-[rgb(var(--border))] my-2 bg-white" />
                )}
                {generatedVisual && <GeneratedTask1VisualCard visual={generatedVisual} />}
                {promptTextToShow && (
                  <p className="text-xs text-[rgb(var(--foreground))] mt-2 leading-relaxed whitespace-pre-line">{promptTextToShow}</p>
                )}
              </details>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={activeText}
            onChange={(e) => setActiveText(e.target.value)}
            placeholder={task1Unavailable && activeTab === "task1" ? "Task 1 пока недоступен..." : "Начните писать эссе здесь..."}
            disabled={task1Unavailable && activeTab === "task1"}
            className={cn(
              "flex-1 w-full resize-none p-6 bg-transparent text-[rgb(var(--foreground))] text-[15px] leading-relaxed",
              "placeholder:text-[rgb(var(--muted))] focus:outline-none",
              task1Unavailable && activeTab === "task1" && "opacity-50 cursor-not-allowed"
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
            <Button size="sm" disabled={submitDisabled} onClick={handleSubmit} className="gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Получить AI Feedback
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WritingTestPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[rgb(var(--background))] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[rgb(var(--primary))]" />
        </div>
      }
    >
      <WritingTestPageContent />
    </Suspense>
  );
}
