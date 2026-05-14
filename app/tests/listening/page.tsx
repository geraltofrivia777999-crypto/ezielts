"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn, formatTime } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Headphones,
  Play,
  Pause,
  Volume2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Shield,
  Coffee,
  Sparkles,
  Eye,
  RotateCcw,
  MessageCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNextListening, saveAttempt } from "@/lib/supabase/queries";
import { ErrorAnalysis } from "@/components/error-analysis";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "strict" | "chill";
type Phase = "intro" | "test" | "results";

type ListeningQuestion = {
  id: string;
  section: number;
  instruction: string;
  text: string;
  options: string[];
  answer: number;
  isMCQ: boolean;
  correctText: string; // raw correct_answer for fill-in checking
};

type ListeningTest = {
  id: string;
  title: string;
  audioUrl: string | null;
  duration: number;
  questions: ListeningQuestion[];
};

type AnswerValue = number | string;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function answerToIndex(answer: string, options: string[]): number {
  const upper = answer.trim().toUpperCase();
  if (/^[A-D]$/.test(upper)) return upper.charCodeAt(0) - 65;
  const idx = options.findIndex((o) => o.toUpperCase() === upper);
  return idx >= 0 ? idx : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbToListeningTest(raw: any): ListeningTest {
  const questions: ListeningQuestion[] = [];
  for (const group of raw.question_groups ?? []) {
    const instruction = (group.instruction as string) ?? "";
    const groupSection = (group.section_number as number) ?? 1;
    for (const q of group.listening_questions ?? []) {
      let raw_opts = q.options;
      if (typeof raw_opts === "string") {
        try { raw_opts = JSON.parse(raw_opts); } catch { raw_opts = null; }
      }
      let opts: string[] = [];
      let isMCQ = false;
      if (Array.isArray(raw_opts) && raw_opts.length > 0) {
        opts = raw_opts;
        isMCQ = true;
      } else if (raw_opts && typeof raw_opts === "object") {
        opts = Object.values(raw_opts as Record<string, string>);
        isMCQ = opts.length > 0;
      }
      questions.push({
        id: q.id,
        section: groupSection,
        instruction,
        text: q.question_text,
        options: opts,
        answer: isMCQ ? answerToIndex(q.correct_answer ?? "", opts) : 0,
        isMCQ,
        correctText: (q.correct_answer ?? "").trim(),
      });
    }
  }
  return {
    id: raw.id,
    title: raw.title,
    audioUrl: raw.audio_url ?? null,
    duration: raw.audio_duration ?? 1800,
    questions,
  };
}

function checkAnswer(q: ListeningQuestion, value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;
  if (q.isMCQ) return value === q.answer;
  if (typeof value !== "string") return false;
  const norm = (s: string) => s.toLowerCase().trim().replace(/[.,!?;:]+$/, "");
  return norm(value) === norm(q.correctText);
}

// ─── Fallback test ────────────────────────────────────────────────────────────

const FALLBACK_TEST: ListeningTest = {
  id: "fallback",
  title: "Sample Listening Test",
  audioUrl: null,
  duration: 1800,
  questions: [
    { id: "l1", section: 1, instruction: "Complete the form below.", text: "Name", options: [], answer: 0, isMCQ: false, correctText: "John" },
    { id: "l2", section: 1, instruction: "Complete the form below.", text: "Age", options: [], answer: 0, isMCQ: false, correctText: "28" },
    { id: "l3", section: 2, instruction: "Choose the correct letter A, B or C.", text: "What time does the centre open?", options: ["8am", "9am", "10am"], answer: 0, isMCQ: true, correctText: "A" },
  ],
};

// ─── Audio Player ─────────────────────────────────────────────────────────────

function AudioPlayer({
  audioUrl, duration: durationProp, mode, onTimeUpdate, onEnded, started, onStart,
}: {
  audioUrl: string | null;
  duration: number;
  mode: Mode;
  onTimeUpdate: (t: number) => void;
  onEnded: () => void;
  started: boolean;
  onStart: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [audioDuration, setAudioDuration] = useState(durationProp);
  const [loading, setLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const duration = audioDuration > 0 ? audioDuration : durationProp;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  async function handlePlayPause() {
    setAudioError(null);
    if (!started) onStart();
    const el = audioRef.current;
    if (!el || !audioUrl) return;

    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      try {
        setLoading(true);
        await el.play();
        setPlaying(true);
      } catch (err) {
        console.error("[audio]", err);
        setAudioError("Не удалось запустить аудио.");
      } finally {
        setLoading(false);
      }
    }
  }

  function seek(deltaSec: number) {
    if (mode === "strict" || !audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + deltaSec));
  }

  function handleSeekClick(e: React.MouseEvent<HTMLDivElement>) {
    if (mode === "strict" || !audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  }

  return (
    <div className="bg-white border border-[rgb(var(--border))] rounded-2xl px-4 py-3 shadow-sm">
      {audioUrl && (
        <audio
          ref={audioRef} src={audioUrl} preload="auto"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setAudioDuration(Math.floor(d));
          }}
          onTimeUpdate={(e) => {
            const t = Math.floor(e.currentTarget.currentTime);
            setCurrentTime(t);
            onTimeUpdate(t);
          }}
          onEnded={() => { setPlaying(false); onEnded(); }}
          onError={() => setAudioError("Ошибка загрузки аудио.")}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      )}

      {audioError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-1.5 mb-2">
          {audioError}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Headphones className="w-4 h-4 text-[rgb(var(--primary))] shrink-0" />
        <span className="text-sm font-medium text-[rgb(var(--foreground))] shrink-0 hidden sm:inline">Listening Audio</span>

        {mode === "chill" && (
          <button onClick={() => seek(-10)} className="p-1.5 rounded-lg hover:bg-[rgb(var(--muted)/0.08)] shrink-0" title="-10 сек">
            <ChevronLeft className="w-4 h-4 text-[rgb(var(--muted-foreground))]" />
          </button>
        )}

        <button
          onClick={handlePlayPause}
          disabled={loading}
          className={cn(
            "w-10 h-10 rounded-full bg-[rgb(var(--primary))] text-white flex items-center justify-center hover:bg-[rgb(var(--primary)/0.9)] shrink-0 transition-transform active:scale-95",
            loading && "opacity-60"
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {mode === "chill" && (
          <button onClick={() => seek(10)} className="p-1.5 rounded-lg hover:bg-[rgb(var(--muted)/0.08)] shrink-0" title="+10 сек">
            <ChevronRight className="w-4 h-4 text-[rgb(var(--muted-foreground))]" />
          </button>
        )}

        <span className="text-xs font-mono text-[rgb(var(--muted-foreground))] shrink-0 tabular-nums">
          {formatTime(currentTime)}
        </span>

        <div
          onClick={handleSeekClick}
          className={cn(
            "relative h-1.5 flex-1 rounded-full bg-[rgb(var(--muted)/0.15)] overflow-hidden",
            mode === "chill" && "cursor-pointer"
          )}
        >
          <div
            className="absolute left-0 top-0 h-full bg-[rgb(var(--primary))] transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        <span className="text-xs font-mono text-[rgb(var(--muted-foreground))] shrink-0 tabular-nums">
          {formatTime(duration)}
        </span>

        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <Volume2 className="w-3.5 h-3.5 text-[rgb(var(--muted-foreground))]" />
          <input
            type="range" min={0} max={1} step={0.05} value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-14 accent-[rgb(var(--primary))] cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Question (input) ─────────────────────────────────────────────────────────

function QuestionInput({
  q, number, value, onChange, disabled, showResult,
}: {
  q: ListeningQuestion;
  number: number;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  disabled: boolean;
  showResult: boolean;
}) {
  const correct = showResult && checkAnswer(q, value);
  const incorrect = showResult && value !== undefined && !correct;
  const empty = showResult && value === undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3 items-start">
        <span className={cn(
          "shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold",
          showResult
            ? correct ? "bg-green-100 text-green-700"
              : empty ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-700"
            : "bg-[rgb(var(--primary)/0.08)] text-[rgb(var(--primary))]"
        )}>
          {number}
        </span>
        <p className="text-sm text-[rgb(var(--foreground))] leading-relaxed flex-1 pt-1">{q.text}</p>
      </div>

      {q.isMCQ ? (
        <div className="flex flex-col gap-1.5 ml-10">
          {q.options.map((opt, i) => {
            const selected = value === i;
            const isCorrectOpt = i === q.answer;
            return (
              <button
                key={i}
                onClick={() => !disabled && onChange(i)}
                disabled={disabled}
                className={cn(
                  "text-left px-3.5 py-2 rounded-lg border text-sm transition-all flex items-center gap-2.5",
                  showResult && isCorrectOpt && "border-green-300 bg-green-50",
                  showResult && selected && !isCorrectOpt && "border-red-300 bg-red-50",
                  !showResult && selected && "border-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.06)]",
                  !showResult && !selected && "border-[rgb(var(--border))] hover:border-[rgb(var(--primary)/0.4)]",
                  disabled && !selected && "opacity-50"
                )}
              >
                <span className={cn(
                  "w-3.5 h-3.5 rounded-full border shrink-0",
                  selected ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))]" : "border-[rgb(var(--muted-foreground))]"
                )} />
                <span className="text-[rgb(var(--foreground))]">{String.fromCharCode(65 + i)}. {opt}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="ml-10">
          <Input
            type="text"
            value={(typeof value === "string" ? value : "")}
            onChange={(e) => !disabled && onChange(e.target.value)}
            disabled={disabled}
            placeholder="Ваш ответ..."
            className={cn(
              "max-w-xs",
              showResult && correct && "border-green-300 bg-green-50",
              showResult && incorrect && "border-red-300 bg-red-50",
              showResult && empty && "border-amber-300 bg-amber-50"
            )}
          />
          {showResult && !correct && (
            <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1.5">
              Правильный ответ: <span className="font-semibold text-green-700">{q.correctText}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Review question (with action buttons) ────────────────────────────────────

function ReviewQuestion({
  q, number, value, onRetry, askAI,
}: {
  q: ListeningQuestion;
  number: number;
  value: AnswerValue | undefined;
  onRetry: () => void;
  askAI: () => void;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const correct = checkAnswer(q, value);

  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col gap-3",
      correct ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30"
    )}>
      <div className="flex gap-3 items-start">
        <span className={cn(
          "shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold",
          correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        )}>{number}</span>
        <p className="text-sm text-[rgb(var(--foreground))] leading-relaxed flex-1">{q.text}</p>
        {correct ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
      </div>

      <div className="ml-10 flex flex-col gap-2">
        {q.isMCQ ? (
          <div className="text-sm">
            <span className="text-[rgb(var(--muted-foreground))]">Ваш: </span>
            <span className={cn("font-medium", correct ? "text-green-700" : "text-red-600")}>
              {typeof value === "number" ? `${String.fromCharCode(65 + value)}. ${q.options[value]}` : "—"}
            </span>
            {showAnswer && !correct && (
              <div className="mt-1">
                <span className="text-[rgb(var(--muted-foreground))]">Правильный: </span>
                <span className="font-medium text-green-700">
                  {String.fromCharCode(65 + q.answer)}. {q.options[q.answer]}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm">
            <span className="text-[rgb(var(--muted-foreground))]">Ваш: </span>
            <span className={cn("font-medium font-mono", correct ? "text-green-700" : "text-red-600")}>
              {typeof value === "string" && value ? value : "—"}
            </span>
            {showAnswer && !correct && (
              <div className="mt-1">
                <span className="text-[rgb(var(--muted-foreground))]">Правильный: </span>
                <span className="font-medium text-green-700 font-mono">{q.correctText}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-1">
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[rgb(var(--border))] text-xs font-medium text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.4)] hover:text-[rgb(var(--primary))] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Попробовать
          </button>
          <button
            onClick={() => setShowAnswer((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[rgb(var(--border))] text-xs font-medium text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.4)] hover:text-[rgb(var(--primary))] transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            {showAnswer ? "Скрыть" : "Показать ответ"}
          </button>
          <button
            onClick={askAI}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Спросить ИИ
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ListeningTestPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("strict");
  const [activeSection, setActiveSection] = useState<number>(1); // 0 = full test, 1..4 = single section
  const [test, setTest] = useState<ListeningTest>(FALLBACK_TEST);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitted, setSubmitted] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [audioEnded, setAudioEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      const sb = createClient();
      try {
        const { data: { user } } = await sb.auth.getUser();
        if (user) userIdRef.current = user.id;
        let raw = user ? await getNextListening(sb, user.id) : null;
        if (!raw) {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const { data: tests } = await (sb as any)
            .from("listening_tests")
            .select("*, question_groups:listening_question_groups(*, listening_questions(*))")
            .not("audio_url", "is", null)
            .order("created_at", { ascending: true })
            .limit(1);
          if (tests && tests.length > 0) raw = tests[0];
        }
        if (raw) {
          const mapped = mapDbToListeningTest(raw);
          if (mapped.questions.length > 0) setTest(mapped);
        }
      } catch (err) {
        console.error("[listening] load:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filtered questions based on activeSection (0 = all, 1..4 = single)
  const visibleQuestions = test.questions.filter(
    (q) => activeSection === 0 || q.section === activeSection
  );
  const sectionsAvailable = Array.from(new Set(test.questions.map((q) => q.section))).sort();
  const totalQ = visibleQuestions.length;
  const answered = visibleQuestions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== "").length;

  const handleAnswer = useCallback((qId: string, v: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [qId]: v }));
  }, []);

  const handleTimeUpdate = useCallback((t: number) => setCurrentTime(t), []);
  const handleAudioEnded = useCallback(() => setAudioEnded(true), []);

  async function handleSubmit() {
    setSubmitted(true);
    setPhase("results");
    if (userIdRef.current && test.id !== "fallback") {
      try {
        const sb = createClient();
        const correctCount = visibleQuestions.filter((q) => checkAnswer(q, answers[q.id])).length;
        const band = correctCount >= totalQ * 0.9 ? 8.0
          : correctCount >= totalQ * 0.75 ? 7.0
          : correctCount >= totalQ * 0.6 ? 6.0
          : correctCount >= totalQ * 0.45 ? 5.5
          : correctCount >= totalQ * 0.3 ? 5.0
          : 4.0;
        await saveAttempt(sb, {
          user_id: userIdRef.current,
          content_type: "listening",
          content_id: test.id,
          /* eslint-disable @typescript-eslint/no-explicit-any */
          answers: answers as any,
          band_score: band,
          raw_score: correctCount,
          total_questions: totalQ,
          time_spent: currentTime,
          ai_feedback: null,
          completed_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[listening] save:", err);
      }
    }
  }

  function startTest(section: number) {
    setActiveSection(section);
    setPhase("test");
    setAnswers({});
    setSubmitted(false);
    setAudioStarted(false);
    setAudioEnded(false);
    setCurrentTime(0);
  }

  function retryQuestion(qId: string) {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  }

  function askAI(q: ListeningQuestion) {
    const params = new URLSearchParams({
      q: `Помоги разобрать вопрос из Listening Test: "${q.text}". Я ответил неправильно. Правильный ответ: ${q.isMCQ ? q.options[q.answer] : q.correctText}. Объясни почему и дай совет на будущее.`,
    });
    router.push(`/tutor?${params.toString()}`);
  }

  // ── Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[rgb(var(--primary))] animate-spin" />
      </div>
    );
  }

  // ── INTRO PHASE: pre-test landing
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))]">
        <header className="sticky top-0 z-40 bg-white border-b border-[rgb(var(--border))]">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
              <ChevronLeft className="w-4 h-4" />Dashboard
            </Link>
            <div className="flex items-center gap-2 ml-2">
              <Headphones className="w-4 h-4 text-purple-500" />
              <span className="font-semibold text-[rgb(var(--foreground))]">{test.title}</span>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl border border-[rgb(var(--border))] shadow-sm p-8 flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Headphones className="w-8 h-8 text-blue-500" />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-[rgb(var(--foreground))] mb-2">IELTS Listening</h1>
              <p className="text-sm text-[rgb(var(--muted-foreground))]">
                4 аудиозаписи с вопросами на понимание услышанного
              </p>
            </div>

            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">30 мин</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">Время</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">{test.questions.length}</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">Вопросов</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">{sectionsAvailable.length}</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">Секций</div>
              </div>
            </div>

            <div className="text-left w-full">
              <h2 className="font-semibold text-[rgb(var(--foreground))] mb-3">Формат теста</h2>
              <ul className="space-y-2 text-sm text-[rgb(var(--muted-foreground))]">
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>4 секции: от простого диалога до академической лекции</li>
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>Аудио проигрывается один раз — слушайте внимательно</li>
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>Типы вопросов: заполнение таблиц, множественный выбор, сопоставление</li>
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>Оценка: Band Score от 1 до 9</li>
              </ul>
            </div>

            <div className="w-full bg-[rgb(var(--muted)/0.05)] rounded-lg px-4 py-2.5 text-xs text-[rgb(var(--muted-foreground))] text-center">
              🌐 Тест проводится полностью на английском языке
            </div>

            <div className="w-full">
              <p className="text-xs text-[rgb(var(--muted-foreground))] mb-3 font-medium">Режим прослушивания</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode("strict")}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    mode === "strict"
                      ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.04)] ring-2 ring-[rgb(var(--primary)/0.15)]"
                      : "border-[rgb(var(--border))] hover:border-[rgb(var(--primary)/0.4)]"
                  )}
                >
                  <Shield className={cn("w-5 h-5 mb-2", mode === "strict" ? "text-[rgb(var(--primary))]" : "text-[rgb(var(--muted-foreground))]")} />
                  <div className="font-semibold text-sm text-[rgb(var(--foreground))]">Strict</div>
                  <div className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">Как на экзамене — без пауз и перемоток</div>
                </button>

                <button
                  onClick={() => setMode("chill")}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    mode === "chill"
                      ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.04)] ring-2 ring-[rgb(var(--primary)/0.15)]"
                      : "border-[rgb(var(--border))] hover:border-[rgb(var(--primary)/0.4)]"
                  )}
                >
                  <Coffee className={cn("w-5 h-5 mb-2", mode === "chill" ? "text-[rgb(var(--primary))]" : "text-[rgb(var(--muted-foreground))]")} />
                  <div className="font-semibold text-sm text-[rgb(var(--foreground))]">Chill</div>
                  <div className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">Пауза, перемотка и управление аудио</div>
                </button>
              </div>
            </div>

            <button
              onClick={() => startTest(0)}
              className="w-full bg-[rgb(var(--primary))] hover:bg-[rgb(var(--primary)/0.92)] text-white font-semibold py-3.5 px-5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md shadow-[rgb(var(--primary)/0.25)]"
            >
              Начать тест Listening
              <ChevronRight className="w-4 h-4" />
            </button>

            {sectionsAvailable.length > 1 && (
              <>
                <div className="relative w-full flex items-center gap-3">
                  <div className="flex-1 h-px bg-[rgb(var(--border))]" />
                  <span className="text-[10px] uppercase tracking-widest text-[rgb(var(--muted-foreground))]">Или практикуйте по секциям</span>
                  <div className="flex-1 h-px bg-[rgb(var(--border))]" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
                  {sectionsAvailable.map((s) => (
                    <button
                      key={s}
                      onClick={() => startTest(s)}
                      className="rounded-xl border border-[rgb(var(--border))] hover:border-[rgb(var(--primary)/0.4)] hover:bg-[rgb(var(--primary)/0.03)] py-2.5 px-3 text-sm font-medium text-[rgb(var(--foreground))] transition-all"
                    >
                      Section {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ── RESULTS PHASE
  if (phase === "results" && submitted) {
    const correctCount = visibleQuestions.filter((q) => checkAnswer(q, answers[q.id])).length;
    const band = correctCount >= totalQ * 0.9 ? 8.0
      : correctCount >= totalQ * 0.75 ? 7.0
      : correctCount >= totalQ * 0.6 ? 6.0
      : correctCount >= totalQ * 0.45 ? 5.5
      : correctCount >= totalQ * 0.3 ? 5.0
      : 4.0;
    const bandColor = band >= 7 ? "text-[rgb(var(--band-high))]" : band >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]";

    // Convert AnswerValue answers into number-based for ErrorAnalysis (only valid for MCQ)
    const numericAnswers: Record<string, number> = {};
    for (const [k, v] of Object.entries(answers)) {
      if (typeof v === "number") numericAnswers[k] = v;
    }

    return (
      <div className="min-h-screen bg-[rgb(var(--background))]">
        <header className="sticky top-0 z-40 bg-white border-b border-[rgb(var(--border))]">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
              <ChevronLeft className="w-4 h-4" />Dashboard
            </Link>
            <div className="flex items-center gap-2 ml-2">
              <Headphones className="w-4 h-4 text-purple-500" />
              <span className="font-semibold text-[rgb(var(--foreground))]">Результаты · {test.title}</span>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
          <div className="bg-white border border-[rgb(var(--border))] rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
            <Badge variant="default">Тест завершён</Badge>
            <div className={cn("font-mono text-6xl font-bold", bandColor)}>{band.toFixed(1)}</div>
            <p className="text-[rgb(var(--muted-foreground))] text-sm">
              Верных: <strong className="text-[rgb(var(--foreground))]">{correctCount} из {totalQ}</strong>
            </p>
            <Progress value={(correctCount / totalQ) * 100} className="w-full max-w-xs h-2"
              indicatorClassName={band >= 7 ? "bg-[rgb(var(--band-high))]" : band >= 5.5 ? "bg-[rgb(var(--band-mid))]" : "bg-[rgb(var(--band-low))]"} />
          </div>

          {/* Error analysis works only on MCQ questions */}
          {visibleQuestions.some((q) => q.isMCQ) && (
            <ErrorAnalysis
              questions={visibleQuestions.filter((q) => q.isMCQ).map((q) => ({
                id: q.id,
                instruction: q.instruction,
                text: q.text,
                options: q.options,
                answer: q.answer,
              }))}
              userAnswers={numericAnswers}
            />
          )}

          <div className="bg-white border border-[rgb(var(--border))] rounded-2xl p-6">
            <h2 className="font-semibold text-[rgb(var(--foreground))] mb-5">Разбор по вопросам</h2>
            <div className="flex flex-col gap-3">
              {visibleQuestions.map((q, i) => (
                <ReviewQuestion
                  key={q.id}
                  q={q}
                  number={i + 1}
                  value={answers[q.id]}
                  onRetry={() => retryQuestion(q.id)}
                  askAI={() => askAI(q)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="flex-1 min-w-[150px] gap-2" onClick={() => { setPhase("test"); setSubmitted(false); }}>
              <RotateCcw className="w-4 h-4" />Пройти снова
            </Button>
            <Button variant="outline" className="flex-1 min-w-[150px]" onClick={() => { setPhase("intro"); setSubmitted(false); }}>
              Пройти ещё тест
            </Button>
            <Button className="flex-1 min-w-[150px]" asChild>
              <Link href="/dashboard">На главную</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ── TEST PHASE
  return (
    <TestPhase
      test={test}
      mode={mode}
      activeSection={activeSection}
      answers={answers}
      onAnswer={handleAnswer}
      audioStarted={audioStarted}
      audioEnded={audioEnded}
      onAudioStart={() => setAudioStarted(true)}
      onAudioEnded={handleAudioEnded}
      onTimeUpdate={handleTimeUpdate}
      onSubmit={handleSubmit}
      onExit={() => setPhase("intro")}
    />
  );
}

// ─── Test phase sub-component ─────────────────────────────────────────────────

function TestPhase({
  test, mode, activeSection, answers, onAnswer, audioStarted, audioEnded,
  onAudioStart, onAudioEnded, onTimeUpdate, onSubmit, onExit,
}: {
  test: ListeningTest;
  mode: Mode;
  activeSection: number;
  answers: Record<string, AnswerValue>;
  onAnswer: (qId: string, v: AnswerValue) => void;
  audioStarted: boolean;
  audioEnded: boolean;
  onAudioStart: () => void;
  onAudioEnded: () => void;
  onTimeUpdate: (t: number) => void;
  onSubmit: () => void;
  onExit: () => void;
}) {
  const sectionsAvailable = Array.from(new Set(test.questions.map((q) => q.section))).sort();
  const isFullTest = activeSection === 0;
  const [currentSection, setCurrentSection] = useState<number>(isFullTest ? sectionsAvailable[0] : activeSection);

  const sectionQuestions = test.questions.filter((q) => q.section === currentSection);
  const allQuestions = isFullTest ? test.questions : sectionQuestions;
  const answeredInTest = allQuestions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== "").length;
  const totalInTest = allQuestions.length;

  const startNum = isFullTest
    ? test.questions.findIndex((q) => q.section === currentSection) + 1
    : 1;
  const endNum = startNum + sectionQuestions.length - 1;

  const sectionLabels: Record<number, string> = {
    1: "Бытовой диалог",
    2: "Бытовой монолог",
    3: "Учебный диалог",
    4: "Академическая лекция",
  };

  const isLastSection = !isFullTest || currentSection === sectionsAvailable[sectionsAvailable.length - 1];
  const isFirstSection = !isFullTest || currentSection === sectionsAvailable[0];

  function goNext() {
    if (isLastSection) {
      onSubmit();
    } else {
      const idx = sectionsAvailable.indexOf(currentSection);
      setCurrentSection(sectionsAvailable[idx + 1]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goPrev() {
    if (!isFirstSection) {
      const idx = sectionsAvailable.indexOf(currentSection);
      setCurrentSection(sectionsAvailable[idx - 1]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--background))]">
      <header className="sticky top-0 z-40 bg-white border-b border-[rgb(var(--border))]">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={onExit} className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
            <ChevronLeft className="w-4 h-4" />Выход
          </button>
          <div className="flex items-center gap-2 ml-2 flex-1 min-w-0">
            <Headphones className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="text-sm font-medium text-[rgb(var(--foreground))] truncate">{test.title}</span>
          </div>

          {isFullTest && sectionsAvailable.length > 1 && (
            <div className="flex gap-1">
              {sectionsAvailable.map((s) => (
                <button
                  key={s}
                  onClick={() => setCurrentSection(s)}
                  className={cn(
                    "w-7 h-7 rounded-md text-xs font-bold transition-colors",
                    s === currentSection
                      ? "bg-[rgb(var(--primary))] text-white"
                      : "bg-[rgb(var(--muted)/0.08)] text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted)/0.15)]"
                  )}
                >{s}</button>
              ))}
            </div>
          )}

          <span className="text-xs font-mono text-[rgb(var(--muted-foreground))] shrink-0 ml-2">
            {answeredInTest}/{totalInTest}
          </span>

          <button
            onClick={() => {
              const params = new URLSearchParams({
                q: `Помоги с Listening Section ${currentSection} (${sectionLabels[currentSection]}). Подскажи как лучше слушать этот тип аудио, на что обращать внимание и как не путать похожие ответы.`,
              });
              window.open(`/tutor?${params.toString()}`, "_blank");
            }}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-50 border border-violet-200 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors shrink-0 ml-2"
          >
            <MessageCircle className="w-3 h-3" />Спросить ИИ
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4">
        <AudioPlayer
          audioUrl={test.audioUrl}
          duration={test.duration}
          mode={mode}
          onTimeUpdate={onTimeUpdate}
          onEnded={onAudioEnded}
          started={audioStarted}
          onStart={onAudioStart}
        />

        {mode === "strict" && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span className="text-amber-900">
              <strong>Strict режим:</strong> аудио играет один раз, перемотка недоступна — как на реальном экзамене.
            </span>
          </div>
        )}

        <div className="mt-5 bg-white border border-[rgb(var(--border))] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-50 text-blue-700 border border-blue-200">Section {currentSection}</Badge>
              <span className="text-xs text-[rgb(var(--muted-foreground))]">{sectionLabels[currentSection]}</span>
            </div>
            <span className="text-xs text-[rgb(var(--muted-foreground))]">
              Questions {startNum}{endNum > startNum ? `–${endNum}` : ""}
            </span>
          </div>

          {sectionQuestions.length > 0 && (
            <p className="text-xs text-[rgb(var(--muted-foreground))] italic mb-4">
              {sectionQuestions[0].instruction}
            </p>
          )}

          <div className="flex flex-col gap-6">
            {sectionQuestions.map((q, i) => (
              <QuestionInput
                key={q.id}
                q={q}
                number={startNum + i}
                value={answers[q.id]}
                onChange={(v) => onAnswer(q.id, v)}
                disabled={mode === "strict" && !audioStarted}
                showResult={false}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 sticky bottom-4 z-30">
          <Button variant="outline" onClick={goPrev} disabled={isFirstSection} className="gap-1.5 bg-white">
            <ChevronLeft className="w-4 h-4" />Назад
          </Button>

          <div className="flex-1 text-center text-xs text-[rgb(var(--muted-foreground))] hidden sm:block">
            {mode === "strict" && !audioEnded ? "Слушайте аудио — отвечайте по ходу" : "Готово? Двигаемся дальше"}
          </div>

          {isLastSection ? (
            <Button
              onClick={onSubmit}
              disabled={mode === "strict" && !audioEnded}
              className="gap-1.5 shadow-md shadow-[rgb(var(--primary)/0.25)]"
            >
              <CheckCircle2 className="w-4 h-4" />Сдать
            </Button>
          ) : (
            <Button onClick={goNext} className="gap-1.5">
              Далее<ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
