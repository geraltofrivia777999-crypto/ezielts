"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatTime } from "@/lib/utils";
import {
  ChevronLeft,
  Headphones,
  Play,
  Pause,
  Volume2,
  CheckCircle2,
  XCircle,
  Flag,
  AlertTriangle,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNextListening, saveAttempt } from "@/lib/supabase/queries";
import { ErrorAnalysis } from "@/components/error-analysis";

// ─── Test types & helpers ─────────────────────────────────────────────────────

type ListeningQuestion = {
  id: string;
  instruction: string;
  text: string;
  options: string[];
  answer: number;
};

type ListeningTest = {
  id: string;
  title: string;
  section: number;
  audioUrl: string | null;
  duration: number;
  questions: ListeningQuestion[];
};

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
    for (const q of group.listening_questions ?? []) {
      const opts: string[] = Array.isArray(q.options) ? q.options
        : typeof q.options === "object" ? Object.values(q.options as Record<string, string>)
        : ["A", "B", "C"];
      questions.push({
        id: q.id,
        instruction,
        text: q.question_text,
        options: opts,
        answer: answerToIndex(q.correct_answer, opts),
      });
    }
  }
  return {
    id: raw.id,
    title: raw.title,
    section: raw.section ?? 1,
    audioUrl: raw.audio_url ?? null,
    duration: raw.audio_duration ?? 240,
    questions,
  };
}

// ─── Fallback test ────────────────────────────────────────────────────────────

const FALLBACK_TEST: ListeningTest = {
  id: "fallback",
  title: "Section 2: Greenfield Community Centre",
  section: 2,
  audioUrl: null,
  duration: 240, // 4 minutes mock
  questions: [
    {
      id: "l1",
      instruction: "Choose the correct letter, A, B or C.",
      text: "What time does the swimming pool close on Saturdays?",
      options: ["8pm", "9pm", "6pm"],
      answer: 2,
    },
    {
      id: "l2",
      instruction: "Choose the correct letter, A, B or C.",
      text: "Which facility is currently CLOSED for refurbishment?",
      options: ["The gym", "The café", "The tennis courts"],
      answer: 1,
    },
    {
      id: "l3",
      instruction: "Choose the correct letter, A, B or C.",
      text: "How much does a monthly membership cost for adults?",
      options: ["£35", "£42", "£50"],
      answer: 1,
    },
    {
      id: "l4",
      instruction: "Choose the correct letter, A, B or C.",
      text: "What discount is available for students?",
      options: ["10%", "20%", "25%"],
      answer: 1,
    },
    {
      id: "l5",
      instruction: "Complete the sentences below. Write NO MORE THAN TWO WORDS.",
      text: "The centre's new app allows members to book _____ in advance.",
      options: ["fitness classes", "swimming lanes", "tennis courts", "all facilities"],
      answer: 0,
    },
    {
      id: "l6",
      instruction: "Choose the correct letter, A, B or C.",
      text: "When does the new children's programme begin?",
      options: ["Next Monday", "Next Saturday", "Next month"],
      answer: 0,
    },
  ],
};

// ─── Custom Audio Player ──────────────────────────────────────────────────────
// IELTS rule: NO rewind allowed — user can only pause/play and adjust volume

function AudioPlayer({
  audioUrl,
  duration,
  onTimeUpdate,
  onEnded,
  started,
  onStart,
}: {
  audioUrl: string | null;
  duration: number;
  onTimeUpdate: (t: number) => void;
  onEnded: () => void;
  started: boolean;
  onStart: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [ended, setEnded] = useState(false);
  // Simulate playback when no real audio
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentTimeRef = useRef(0);

  useEffect(() => {
    if (playing && !audioUrl) {
      timerRef.current = setInterval(() => {
        currentTimeRef.current += 1;
        const next = currentTimeRef.current;
        setCurrentTime(next);
        onTimeUpdate(next);
        if (next >= duration) {
          setPlaying(false);
          setEnded(true);
          onEnded();
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, audioUrl, duration, onTimeUpdate, onEnded]);

  function handlePlayPause() {
    if (!started) {
      onStart();
    }
    setPlaying((p) => !p);
    if (audioRef.current) {
      playing ? audioRef.current.pause() : audioRef.current.play();
    }
  }

  const progress = (currentTime / duration) * 100;

  return (
    <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={(e) => {
            const t = Math.floor(e.currentTarget.currentTime);
            setCurrentTime(t);
            onTimeUpdate(t);
          }}
          onEnded={() => { setEnded(true); onEnded(); }}
        />
      )}

      {/* IELTS warning */}
      <div className="flex items-start gap-2.5 mb-4 p-3 rounded-xl bg-[rgb(var(--warning)/0.08)] border border-[rgb(var(--warning)/0.2)]">
        <AlertTriangle className="w-4 h-4 text-[rgb(var(--warning))] shrink-0 mt-0.5" />
        <p className="text-xs text-[rgb(var(--foreground))]">
          <strong>Правило IELTS:</strong> аудио воспроизводится <strong>один раз</strong>. Перемотка
          назад недоступна — как на реальном экзамене.
        </p>
      </div>

      {/* Player controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={handlePlayPause}
          disabled={ended}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0",
            ended
              ? "bg-[rgb(var(--surface-elevated))] text-[rgb(var(--muted))] cursor-not-allowed"
              : "bg-[rgb(var(--primary))] text-white hover:bg-[rgb(var(--primary)/0.88)] active:scale-95 shadow-md shadow-[rgb(var(--primary)/0.3)]"
          )}
        >
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex justify-between text-xs font-mono text-[rgb(var(--muted-foreground))]">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          {/* Progress only — no click/scrub (IELTS rule) */}
          <div className="relative h-2 w-full rounded-full bg-[rgb(var(--surface-elevated))] overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-[rgb(var(--primary))] transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
          {ended && (
            <span className="text-xs text-[rgb(var(--muted-foreground))]">Аудио завершено</span>
          )}
        </div>

        {/* Volume (allowed) */}
        <div className="flex items-center gap-2 shrink-0">
          <Volume2 className="w-4 h-4 text-[rgb(var(--muted-foreground))]" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (audioRef.current) audioRef.current.volume = v;
            }}
            className="w-16 accent-[rgb(var(--primary))] cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Question item ─────────────────────────────────────────────────────────────

function QuestionItem({
  q,
  index,
  userAnswer,
  onAnswer,
  showResult,
  audioStarted,
}: {
  q: ListeningQuestion;
  index: number;
  userAnswer: number | undefined;
  onAnswer: (i: number) => void;
  showResult: boolean;
  audioStarted: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 pb-6 border-b border-[rgb(var(--border))] last:border-0 last:pb-0">
      <p className="text-xs text-[rgb(var(--muted-foreground))] italic">{q.instruction}</p>
      <div className="flex gap-2">
        <span className="shrink-0 w-6 h-6 rounded-full bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--primary))] text-xs font-bold flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <p className="font-medium text-sm text-[rgb(var(--foreground))] leading-snug">{q.text}</p>
      </div>
      <div className="flex flex-col gap-2 ml-8">
        {q.options.map((opt, i) => {
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
              onClick={() => !showResult && audioStarted && onAnswer(i)}
              disabled={!audioStarted && !showResult}
              className={cn(
                "w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition-all flex items-center gap-2.5",
                !audioStarted && !showResult && "opacity-50 cursor-not-allowed",
                state === "default" && audioStarted && "border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:border-[rgb(var(--primary)/0.4)]",
                state === "default" && !audioStarted && "border-[rgb(var(--border))] bg-[rgb(var(--surface))]",
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
                <span className={cn("w-3.5 h-3.5 rounded-full border shrink-0",
                  isSelected ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))]" : "border-[rgb(var(--border))]"
                )} />
              )}
              <span className={cn(
                "text-[rgb(var(--foreground))]",
                state === "correct" && "text-[rgb(var(--success))] font-medium",
                state === "wrong" && "text-[rgb(var(--destructive))]",
                state === "selected" && "text-[rgb(var(--primary))] font-medium"
              )}>
                <strong className="mr-1">{String.fromCharCode(65 + i)}.</strong>{opt}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ListeningTestPage() {
  const [test, setTest] = useState<ListeningTest>(FALLBACK_TEST);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [audioEnded, setAudioEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const userIdRef = useRef<string | null>(null);

  // Load test from Supabase
  useEffect(() => {
    async function load() {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (user) userIdRef.current = user.id;
        const raw = user ? await getNextListening(sb, user.id) : null;
        if (raw) {
          const mapped = mapDbToListeningTest(raw);
          if (mapped.questions.length > 0) setTest(mapped);
        }
      } catch { /* use fallback */ }
    }
    load();
  }, []);

  const totalQ = test.questions.length;
  const answered = Object.keys(answers).length;
  const score = submitted ? test.questions.filter((q) => answers[q.id] === q.answer).length : 0;
  const band = submitted
    ? score >= 6 ? 8.0 : score >= 5 ? 7.0 : score >= 4 ? 6.0 : score >= 3 ? 5.5 : score >= 2 ? 5.0 : 4.0
    : null;

  const handleAnswer = useCallback((qId: string, i: number) => {
    setAnswers((prev) => ({ ...prev, [qId]: i }));
  }, []);

  const handleTimeUpdate = useCallback((t: number) => setCurrentTime(t), []);
  const handleAudioEnded = useCallback(() => setAudioEnded(true), []);

  // ── Results ──
  if (submitted && band !== null) {
    const bandColor = band >= 7 ? "text-[rgb(var(--band-high))]" : band >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]";
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col">
        <header className="sticky top-0 z-40 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
              <ChevronLeft className="w-4 h-4" />Dashboard
            </Link>
          </div>
        </header>
        <div className="max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 text-center flex flex-col items-center gap-3">
            <Badge variant="default">Тест завершён</Badge>
            <div className={cn("font-mono text-6xl font-bold", bandColor)}>{band.toFixed(1)}</div>
            <p className="text-[rgb(var(--muted-foreground))] text-sm">Верных: <strong className="text-[rgb(var(--foreground))]">{score} из {totalQ}</strong></p>
            <Progress value={(score / totalQ) * 100} className="w-full max-w-xs h-2"
              indicatorClassName={band >= 7 ? "bg-[rgb(var(--band-high))]" : band >= 5.5 ? "bg-[rgb(var(--band-mid))]" : "bg-[rgb(var(--band-low))]"} />
          </div>
          <ErrorAnalysis questions={test.questions} userAnswers={answers} />
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
            <h2 className="font-semibold text-[rgb(var(--foreground))] mb-5">Разбор по вопросам</h2>
            <div className="flex flex-col gap-6">
              {test.questions.map((q, i) => (
                <QuestionItem key={q.id} q={q} index={i} userAnswer={answers[q.id]} onAnswer={() => {}} showResult={true} audioStarted={true} />
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[rgb(var(--background))]">
      {/* Header */}
      <header className="shrink-0 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))] z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] shrink-0">
            <ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Headphones className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="text-sm font-medium text-[rgb(var(--foreground))] truncate">{test.title}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="text-xs text-[rgb(var(--muted-foreground))]">{answered}/{totalQ}</span>
            <Progress value={(answered / totalQ) * 100} className="w-20 h-1.5" />
          </div>
          <Button size="sm" className="shrink-0" disabled={!audioEnded || answered < totalQ} onClick={async () => {
                    setSubmitted(true);
                    if (userIdRef.current && test.id !== "fallback") {
                      try {
                        const sb = createClient();
                        const sc = test.questions.filter((q) => answers[q.id] === q.answer).length;
                        const bd = sc >= 6 ? 8.0 : sc >= 5 ? 7.0 : sc >= 4 ? 6.0 : sc >= 3 ? 5.5 : sc >= 2 ? 5.0 : 4.0;
                        await saveAttempt(sb, { user_id: userIdRef.current!, content_type: "listening", content_id: test.id, answers, band_score: bd, raw_score: sc, total_questions: test.questions.length, time_spent: currentTime, ai_feedback: null, completed_at: new Date().toISOString() });
                      } catch { /* non-fatal */ }
                    }
                  }}>
            <Flag className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">Сдать</span>
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
          {/* Audio player */}
          <AudioPlayer
            audioUrl={test.audioUrl}
            duration={test.duration}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleAudioEnded}
            started={audioStarted}
            onStart={() => setAudioStarted(true)}
          />

          {/* Listen-first notice */}
          {!audioStarted && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-[rgb(var(--foreground))]">
                Нажми <strong>Play</strong> чтобы начать. Вопросы станут доступны после начала воспроизведения.
              </p>
            </div>
          )}

          {/* Questions */}
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-[rgb(var(--foreground))]">Questions 1–{totalQ}</h2>
              <span className="text-xs text-[rgb(var(--muted-foreground))]">{answered} из {totalQ}</span>
            </div>
            <div className="flex flex-col gap-6">
              {test.questions.map((q, i) => (
                <QuestionItem
                  key={q.id} q={q} index={i}
                  userAnswer={answers[q.id]}
                  onAnswer={(idx) => handleAnswer(q.id, idx)}
                  showResult={false}
                  audioStarted={audioStarted}
                />
              ))}
            </div>
            <Button
              size="lg" className="w-full mt-6"
              disabled={!audioEnded || answered < totalQ}
              onClick={async () => {
                    setSubmitted(true);
                    if (userIdRef.current && test.id !== "fallback") {
                      try {
                        const sb = createClient();
                        const sc = test.questions.filter((q) => answers[q.id] === q.answer).length;
                        const bd = sc >= 6 ? 8.0 : sc >= 5 ? 7.0 : sc >= 4 ? 6.0 : sc >= 3 ? 5.5 : sc >= 2 ? 5.0 : 4.0;
                        await saveAttempt(sb, { user_id: userIdRef.current!, content_type: "listening", content_id: test.id, answers, band_score: bd, raw_score: sc, total_questions: test.questions.length, time_spent: currentTime, ai_feedback: null, completed_at: new Date().toISOString() });
                      } catch { /* non-fatal */ }
                    }
                  }}
            >
              <Flag className="w-4 h-4" />
              {!audioEnded ? "Дождитесь окончания аудио" : `Сдать (${answered}/${totalQ})`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
