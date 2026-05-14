"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatTime, rawToBand } from "@/lib/utils";
import {
  ChevronLeft,
  Headphones,
  Play,
  Pause,
  Volume2,
  CheckCircle2,
  XCircle,
  Flag,
  Info,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Coffee,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNextListening, saveAttempt } from "@/lib/supabase/queries";
import { ErrorAnalysis } from "@/components/error-analysis";
import {
  mapDbToListeningTest,
  matchesText,
  type ListeningTest,
  type ListeningQuestion,
} from "@/lib/test-mapping/listening";

// ─── Fallback test (used until DB content loads) ─────────────────────────────

const FALLBACK_TEST: ListeningTest = {
  id: "fallback",
  title: "Section 2 — Greenfield Community Centre",
  audioUrl: null,
  duration: 240,
  sections: [
    {
      sectionNumber: 2,
      questions: [
        {
          id: "l1",
          kind: "mcq",
          instruction: "Choose the correct letter, A, B or C.",
          text: "What time does the swimming pool close on Saturdays?",
          options: ["8pm", "9pm", "6pm"],
          answer: 2,
        },
        {
          id: "l2",
          kind: "mcq",
          instruction: "Choose the correct letter, A, B or C.",
          text: "Which facility is currently CLOSED for refurbishment?",
          options: ["The gym", "The café", "The tennis courts"],
          answer: 1,
        },
        {
          id: "l3",
          kind: "text",
          instruction: "Complete the notes below. Write NO MORE THAN TWO WORDS.",
          text: "Adult membership costs £____ per month.",
          answer: null,
          expectedText: "42",
        },
        {
          id: "l4",
          kind: "text",
          instruction: "Complete the notes below. Write NO MORE THAN TWO WORDS.",
          text: "The new app lets members book ____ in advance.",
          answer: null,
          expectedText: "fitness classes",
        },
        {
          id: "l5",
          kind: "mcq",
          instruction: "Choose the correct letter, A, B or C.",
          text: "When does the new children's programme begin?",
          options: ["Next Monday", "Next Saturday", "Next month"],
          answer: 0,
        },
      ],
    },
  ],
};

// ─── Loading skeleton ────────────────────────────────────────────────────────

function ListeningSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-[rgb(var(--background))]">
      <header className="h-14 border-b border-[rgb(var(--border))] flex items-center px-4 gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-[rgb(var(--muted-foreground))]" />
        <span className="text-sm text-[rgb(var(--muted-foreground))]">Загрузка теста…</span>
      </header>
      <div className="max-w-3xl mx-auto w-full p-6 space-y-4">
        <div className="h-24 bg-[rgb(var(--surface-elevated))] rounded-2xl animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-[rgb(var(--surface-elevated))] rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// Mode = strict (real exam: single play, no pause, no rewind) | chill (training).
type ListeningMode = "strict" | "chill";

// ─── Audio player ────────────────────────────────────────────────────────────
// In `strict` mode the player enforces real-IELTS rules: audio plays exactly
// once, pause and rewind are disabled. The previous build always rendered a
// "Strict режим" banner but never wired the rules — pausing was possible.

function AudioPlayer({
  audioUrl,
  duration: durationProp,
  onTimeUpdate,
  onEnded,
  started,
  onStart,
  mode,
}: {
  audioUrl: string | null;
  duration: number;
  onTimeUpdate: (t: number) => void;
  onEnded: () => void;
  started: boolean;
  onStart: () => void;
  mode: ListeningMode;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [ended, setEnded] = useState(false);
  const [audioDuration, setAudioDuration] = useState(durationProp);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const duration = audioDuration > 0 ? audioDuration : durationProp;

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  async function handlePlayPause() {
    setAudioError(null);
    const el = audioRef.current;
    if (!el || !audioUrl) {
      setAudioError("Аудио для этого теста недоступно. Выберите другой тест.");
      return;
    }

    // STRICT mode: once playback has started, the user cannot pause —
    // play continues until the audio naturally ends. This matches the
    // real IELTS exam where the recording cannot be stopped or rewound.
    if (mode === "strict" && started) {
      // No-op: keep the button visually disabled. Defence-in-depth in case
      // the disabled attribute is bypassed.
      return;
    }

    if (!started) onStart();
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    try {
      setLoading(true);
      await el.play();
      setPlaying(true);
    } catch (err) {
      console.error("[audio play]", err);
      setAudioError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Браузер заблокировал воспроизведение. Кликните по плееру ещё раз."
          : "Не удалось запустить аудио. Проверьте соединение."
      );
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }

  // In strict mode the play button must lock once playback has started.
  const playButtonDisabled =
    ended || loading || !audioUrl || (mode === "strict" && started);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setAudioDuration(Math.floor(d));
          }}
          onTimeUpdate={(e) => {
            const t = Math.floor(e.currentTarget.currentTime);
            setCurrentTime(t);
            onTimeUpdate(t);
          }}
          onEnded={() => { setPlaying(false); setEnded(true); onEnded(); }}
          onError={(e) => {
            const err = e.currentTarget.error;
            console.error("[audio error]", err?.code, err?.message);
            setAudioError(`Ошибка загрузки аудио (код ${err?.code ?? "?"})`);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      )}

      {audioError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">
          {audioError}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={handlePlayPause}
          disabled={playButtonDisabled}
          aria-label={
            mode === "strict" && started
              ? "Аудио играет — нельзя останавливать в strict-режиме"
              : playing ? "Pause" : "Play"
          }
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0",
            playButtonDisabled
              ? "bg-[rgb(var(--surface-elevated))] text-[rgb(var(--muted))] cursor-not-allowed"
              : "bg-[rgb(var(--primary))] text-white hover:bg-[rgb(var(--primary)/0.88)] active:scale-95 shadow-md"
          )}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" />
            : (playing && mode === "chill") ? <Pause className="w-5 h-5" />
            : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex justify-between text-xs font-mono text-[rgb(var(--muted-foreground))]">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-[rgb(var(--surface-elevated))] overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-[rgb(var(--primary))] transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
          {ended && <span className="text-xs text-[rgb(var(--muted-foreground))]">Аудио завершено</span>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Volume2 className="w-4 h-4 text-[rgb(var(--muted-foreground))]" />
          <input
            type="range" min={0} max={1} step={0.05} value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-16 accent-[rgb(var(--primary))] cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Question item ───────────────────────────────────────────────────────────
// Renders MCQ as radio buttons OR free-text as a real <input> (the old bug
// was rendering completion questions as a single radio button "[Введите ответ]"
// that the user could not actually fill in).

function QuestionItem({
  q,
  index,
  userAnswer,
  onAnswer,
  showResult,
}: {
  q: ListeningQuestion;
  index: number;
  userAnswer: number | string | undefined;
  onAnswer: (value: number | string) => void;
  showResult: boolean;
}) {
  // Mark MCQ correct against q.answer; text correct against q.expectedText
  const isMcqCorrect = q.kind === "mcq" && typeof userAnswer === "number" && userAnswer === q.answer;
  const isTextCorrect =
    q.kind === "text" && typeof userAnswer === "string" && matchesText(userAnswer, q.expectedText);

  return (
    <div className="flex flex-col gap-3 pb-6 border-b border-[rgb(var(--border))] last:border-0 last:pb-0">
      <p className="text-xs text-[rgb(var(--muted-foreground))] italic">{q.instruction}</p>
      <div className="flex gap-2">
        <span className="shrink-0 w-6 h-6 rounded-full bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--primary))] text-xs font-bold flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <p className="font-medium text-sm text-[rgb(var(--foreground))] leading-snug">{q.text}</p>
      </div>

      {q.kind === "mcq" ? (
        <div className="flex flex-col gap-2 ml-8">
          {q.options?.map((opt, i) => {
            const isSelected = userAnswer === i;
            const isCorrect = i === q.answer;
            let state: "default" | "selected" | "correct" | "wrong" = "default";
            if (showResult) {
              if (isCorrect) state = "correct";
              else if (isSelected) state = "wrong";
            } else if (isSelected) state = "selected";

            return (
              <button
                key={i}
                onClick={() => !showResult && onAnswer(i)}
                disabled={showResult}
                className={cn(
                  "w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition-all flex items-center gap-2.5",
                  state === "default" && "border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:border-[rgb(var(--primary)/0.4)]",
                  state === "selected" && "border-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.07)] font-medium",
                  state === "correct" && "border-[rgb(var(--success))] bg-[rgb(var(--success)/0.07)]",
                  state === "wrong" && "border-[rgb(var(--destructive))] bg-[rgb(var(--destructive)/0.07)]",
                  showResult && "cursor-default"
                )}
              >
                {showResult ? (
                  isCorrect ? <CheckCircle2 className="w-3.5 h-3.5 text-[rgb(var(--success))] shrink-0" />
                    : isSelected ? <XCircle className="w-3.5 h-3.5 text-[rgb(var(--destructive))] shrink-0" />
                    : <span className="w-3.5 h-3.5 rounded-full border border-[rgb(var(--border))] shrink-0" />
                ) : (
                  <span className={cn(
                    "w-3.5 h-3.5 rounded-full border shrink-0",
                    isSelected ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))]" : "border-[rgb(var(--border))]"
                  )} />
                )}
                <span><strong className="mr-1">{String.fromCharCode(65 + i)}.</strong>{opt}</span>
              </button>
            );
          })}
        </div>
      ) : (
        // FREE-TEXT input for completion / short-answer questions
        <div className="ml-8 flex flex-col gap-1.5">
          <input
            type="text"
            value={typeof userAnswer === "string" ? userAnswer : ""}
            onChange={(e) => onAnswer(e.target.value)}
            disabled={showResult}
            placeholder="Ваш ответ…"
            className={cn(
              "w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all",
              "border-[rgb(var(--border))] bg-[rgb(var(--surface))]",
              "focus:outline-none focus:border-[rgb(var(--primary))] focus:bg-[rgb(var(--primary)/0.04)]",
              showResult && (isTextCorrect
                ? "border-[rgb(var(--success))] bg-[rgb(var(--success)/0.07)]"
                : "border-[rgb(var(--destructive))] bg-[rgb(var(--destructive)/0.07)]"),
              showResult && "cursor-not-allowed"
            )}
          />
          {showResult && (
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              {isTextCorrect ? (
                <span className="text-[rgb(var(--success))] font-medium inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Верно
                </span>
              ) : (
                <span className="text-[rgb(var(--destructive))] inline-flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Правильный ответ: <strong className="ml-1">{q.expectedText}</strong>
                </span>
              )}
            </p>
          )}
          {/* Quiet correctness preview while not yet submitted — not shown */}
          <span className="sr-only">{isMcqCorrect ? "" : ""}</span>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ListeningTestPage() {
  const [test, setTest] = useState<ListeningTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [audioEnded, setAudioEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // STRICT = real-exam rules (one-shot audio, no pause/rewind).
  // CHILL  = training mode (full control over the audio).
  // Default to strict — that's the value of an IELTS prep platform.
  const [mode, setMode] = useState<ListeningMode>("strict");
  const userIdRef = useRef<string | null>(null);

  // ── Load ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const sb = createClient();
      try {
        const { data: { user } } = await sb.auth.getUser();
        if (cancelled) return;
        if (user) userIdRef.current = user.id;

        let raw = user ? await getNextListening(sb, user.id) : null;
        if (!raw) {
          // Direct fallback query: any listening test with audio
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const { data: tests } = await (sb as any)
            .from("listening_tests")
            .select("*, question_groups:listening_question_groups(*, listening_questions(*))")
            .not("audio_url", "is", null)
            .order("created_at", { ascending: true })
            .limit(1);
          if (tests && tests.length > 0) raw = tests[0];
        }
        if (cancelled) return;

        if (raw) {
          const mapped = mapDbToListeningTest(raw);
          const qCount = mapped.sections.reduce((s, sec) => s + sec.questions.length, 0);
          if (qCount > 0) {
            setTest(mapped);
            setLoading(false);
            return;
          }
        }
        setTest(FALLBACK_TEST);
      } catch (err) {
        console.error("[listening] load error:", err);
        if (!cancelled) setTest(FALLBACK_TEST);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Derived ──
  const allQuestions = useMemo<ListeningQuestion[]>(
    () => (test ? test.sections.flatMap((s) => s.questions) : []),
    [test]
  );
  const totalQ = allQuestions.length;

  // "Answered" = user provided non-empty answer of the right shape
  const answeredCount = allQuestions.filter((q) => {
    const v = answers[q.id];
    if (q.kind === "mcq") return typeof v === "number";
    return typeof v === "string" && v.trim().length > 0;
  }).length;

  const score = useMemo(() => {
    if (!submitted) return 0;
    return allQuestions.filter((q) => {
      const v = answers[q.id];
      if (q.kind === "mcq") return typeof v === "number" && v === q.answer;
      return typeof v === "string" && matchesText(v, q.expectedText);
    }).length;
  }, [submitted, allQuestions, answers]);

  const band = submitted && totalQ > 0 ? rawToBand(score, totalQ) : null;

  // ── Handlers ──
  const handleAnswer = useCallback((qId: string, value: number | string) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!test) return;
    setSubmitted(true);
    if (userIdRef.current && test.id !== "fallback") {
      try {
        const sb = createClient();
        const sc = allQuestions.filter((q) => {
          const v = answers[q.id];
          if (q.kind === "mcq") return typeof v === "number" && v === q.answer;
          return typeof v === "string" && matchesText(v, q.expectedText);
        }).length;
        const bd = rawToBand(sc, totalQ);
        await saveAttempt(sb, {
          user_id: userIdRef.current,
          content_type: "listening",
          content_id: test.id,
          answers,
          band_score: bd,
          raw_score: sc,
          total_questions: totalQ,
          time_spent: currentTime,
          ai_feedback: null,
          completed_at: new Date().toISOString(),
        });
      } catch { /* non-fatal */ }
    }
  }, [test, answers, allQuestions, totalQ, currentTime]);

  if (loading || !test) return <ListeningSkeleton />;

  // For ErrorAnalysis we need (question.answer: number). Only MCQ questions
  // are gradable in that component for now.
  const mcqOnly = allQuestions
    .filter((q) => q.kind === "mcq")
    .map((q) => ({
      id: q.id,
      instruction: q.instruction,
      text: q.text,
      options: q.options ?? [],
      answer: q.answer ?? 0,
    }));
  const mcqAnswers: Record<string, number> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (typeof v === "number") mcqAnswers[k] = v;
  }

  // ── Results ──
  if (submitted && band !== null) {
    const bandColor =
      band >= 7 ? "text-[rgb(var(--band-high))]" : band >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]";
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col">
        <header className="sticky top-0 z-40 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))]">
              <ChevronLeft className="w-4 h-4" />Dashboard
            </Link>
          </div>
        </header>
        <div className="max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 text-center flex flex-col items-center gap-3">
            <Badge variant="default">Тест завершён</Badge>
            <div className={cn("font-mono text-6xl font-bold", bandColor)}>{band.toFixed(1)}</div>
            <p className="text-[rgb(var(--muted-foreground))] text-sm">
              Верных: <strong className="text-[rgb(var(--foreground))]">{score} из {totalQ}</strong>
            </p>
            <Progress
              value={(score / totalQ) * 100}
              className="w-full max-w-xs h-2"
              indicatorClassName={
                band >= 7 ? "bg-[rgb(var(--band-high))]" : band >= 5.5 ? "bg-[rgb(var(--band-mid))]" : "bg-[rgb(var(--band-low))]"
              }
            />
          </div>

          {mcqOnly.length > 0 && (
            <ErrorAnalysis questions={mcqOnly} userAnswers={mcqAnswers} />
          )}

          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
            <h2 className="font-semibold text-[rgb(var(--foreground))] mb-5">Разбор по вопросам</h2>
            <div className="flex flex-col gap-6">
              {allQuestions.map((q, i) => (
                <QuestionItem key={q.id} q={q} index={i} userAnswer={answers[q.id]} onAnswer={() => {}} showResult={true} />
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" asChild><Link href="/dashboard">Dashboard</Link></Button>
            <Button className="flex-1" asChild><Link href="/tests/listening">Следующий тест</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active test ──
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[rgb(var(--background))]">
      <header className="shrink-0 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))] z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] shrink-0">
            <ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Headphones className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="text-sm font-medium truncate">{test.title}</span>
          </div>
          {/* Strict / Chill toggle. Disabled once audio has started — switching
              mid-test would let users sidestep the strict rules they signed up for. */}
          <div
            role="group"
            aria-label="Режим тренировки"
            className="hidden md:inline-flex items-center gap-0.5 bg-[rgb(var(--surface-elevated))] rounded-lg p-0.5 shrink-0"
          >
            {(["strict", "chill"] as ListeningMode[]).map((m) => {
              const active = mode === m;
              const Icon = m === "strict" ? ShieldCheck : Coffee;
              return (
                <button
                  key={m}
                  onClick={() => !audioStarted && setMode(m)}
                  disabled={audioStarted}
                  title={
                    m === "strict"
                      ? "Strict: аудио играет один раз, нельзя ставить на паузу"
                      : "Chill: можно ставить на паузу и доигрывать заново"
                  }
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                    active
                      ? m === "strict"
                        ? "bg-[rgb(var(--warning)/0.15)] text-[rgb(var(--warning))]"
                        : "bg-[rgb(var(--primary)/0.12)] text-[rgb(var(--primary))]"
                      : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]",
                    audioStarted && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {m === "strict" ? "Strict" : "Chill"}
                </button>
              );
            })}
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="text-xs text-[rgb(var(--muted-foreground))]">{answeredCount}/{totalQ}</span>
            <Progress value={(answeredCount / totalQ) * 100} className="w-20 h-1.5" />
          </div>
          <Button
            size="sm"
            className="shrink-0"
            // In chill mode users can submit whenever they want; in strict they
            // must wait for the audio to finish (real-exam workflow).
            disabled={mode === "strict" && !audioEnded}
            onClick={handleSubmit}
          >
            <Flag className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">Сдать</span>
          </Button>
        </div>

        {/* Mode banner — appears under the header bar */}
        <div
          className={cn(
            "border-t px-4 py-1.5 text-xs flex items-center gap-2",
            mode === "strict"
              ? "bg-[rgb(var(--warning)/0.08)] border-[rgb(var(--warning)/0.2)] text-[rgb(var(--warning))]"
              : "bg-[rgb(var(--primary)/0.06)] border-[rgb(var(--primary)/0.2)] text-[rgb(var(--primary))]"
          )}
        >
          {mode === "strict" ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5" />
              <span><strong>Strict-режим:</strong> аудио играет один раз, паузу ставить нельзя — как на реальном IELTS.</span>
            </>
          ) : (
            <>
              <Coffee className="w-3.5 h-3.5" />
              <span><strong>Chill-режим:</strong> можно ставить на паузу и сдавать тест в любое время. Подойдёт для отработки.</span>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
          <AudioPlayer
            audioUrl={test.audioUrl}
            duration={test.duration}
            onTimeUpdate={setCurrentTime}
            onEnded={() => setAudioEnded(true)}
            started={audioStarted}
            onStart={() => setAudioStarted(true)}
            mode={mode}
          />

          {/* Real-IELTS behaviour: questions are visible BEFORE audio starts so
              candidates can read ahead — they just can't submit until audio ends. */}
          {!audioStarted && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-[rgb(var(--foreground))]">
                Прочитайте вопросы заранее, затем нажмите <strong>Play</strong>. Записывайте ответы по ходу аудио — оно проигрывается <strong>один раз</strong>.
              </p>
            </div>
          )}

          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-[rgb(var(--foreground))]">Questions 1–{totalQ}</h2>
              <span className="text-xs text-[rgb(var(--muted-foreground))]">{answeredCount} из {totalQ}</span>
            </div>
            <div className="flex flex-col gap-6">
              {allQuestions.map((q, i) => (
                <QuestionItem
                  key={q.id}
                  q={q}
                  index={i}
                  userAnswer={answers[q.id]}
                  onAnswer={(v) => handleAnswer(q.id, v)}
                  showResult={false}
                />
              ))}
            </div>
            <Button
              size="lg"
              className="w-full mt-6"
              disabled={mode === "strict" && !audioEnded}
              onClick={handleSubmit}
            >
              <Flag className="w-4 h-4" />
              {mode === "strict" && !audioEnded
                ? "Дождитесь окончания аудио"
                : `Сдать (${answeredCount}/${totalQ})`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
