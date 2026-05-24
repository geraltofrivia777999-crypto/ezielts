"use client";

import { Suspense, useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  Eye,
  MessageCircle,
  Send,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkDailyLimit, getListeningTest, getNextListening, incrementUsage, saveAttempt } from "@/lib/supabase/queries";
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

function ListeningStartScreen({
  test,
  mode,
  onModeChange,
  onStartFull,
  onStartSection,
}: {
  test: ListeningTest;
  mode: ListeningMode;
  onModeChange: (mode: ListeningMode) => void;
  onStartFull: () => void;
  onStartSection: (sectionNumber: number) => void;
}) {
  const questionCount = test.sections.reduce((sum, section) => sum + section.questions.length, 0);
  const sectionCount = test.sections.length;

  return (
    <div className="min-h-screen bg-[rgb(var(--background))]">
      <header className="bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] shrink-0">
            <ChevronLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Headphones className="w-4 h-4 text-[rgb(var(--primary))]" />
            <span className="text-sm font-medium truncate">IELTS Listening</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-56px)] max-w-5xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--primary))]">
              <Headphones className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-[rgb(var(--foreground))]">IELTS Listening</h1>
            <p className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">
              4 аудиозаписи с вопросами на понимание услышанного
            </p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xl font-bold text-[rgb(var(--primary))]">30 мин</div>
              <div className="text-xs text-[rgb(var(--muted-foreground))]">Время</div>
            </div>
            <div>
              <div className="text-xl font-bold text-[rgb(var(--primary))]">{questionCount}</div>
              <div className="text-xs text-[rgb(var(--muted-foreground))]">Вопросов</div>
            </div>
            <div>
              <div className="text-xl font-bold text-[rgb(var(--primary))]">{sectionCount}</div>
              <div className="text-xs text-[rgb(var(--muted-foreground))]">Секций</div>
            </div>
          </div>

          <div className="mt-7">
            <h2 className="text-sm font-semibold text-[rgb(var(--foreground))]">Формат теста</h2>
            <ul className="mt-3 space-y-2 text-sm text-[rgb(var(--muted-foreground))]">
              <li>• 4 секции: от простого диалога до академической лекции</li>
              <li>• В strict аудио проигрывается один раз, без паузы и перемотки</li>
              <li>• Типы вопросов: заполнение таблиц, множественный выбор, сопоставление</li>
              <li>• Оценка: Band Score от 1 до 9</li>
            </ul>
          </div>

          <div className="mt-5 rounded-xl bg-[rgb(var(--surface-elevated))] px-3 py-2 text-xs text-[rgb(var(--muted-foreground))]">
            Тест проводится полностью на английском языке
          </div>

          <div className="mt-6">
            <p className="mb-2 text-center text-xs font-medium text-[rgb(var(--foreground))]">Режим прослушивания</p>
            <div className="grid grid-cols-2 gap-2">
              {(["strict", "chill"] as ListeningMode[]).map((item) => {
                const active = mode === item;
                const Icon = item === "strict" ? ShieldCheck : Coffee;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onModeChange(item)}
                    className={cn(
                      "rounded-xl border p-3 text-center transition-colors",
                      active
                        ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.06)]"
                        : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:border-[rgb(var(--primary)/0.35)]"
                    )}
                  >
                    <Icon className="mx-auto mb-2 h-4 w-4 text-[rgb(var(--primary))]" />
                    <div className="text-sm font-semibold text-[rgb(var(--foreground))]">
                      {item === "strict" ? "Strict" : "Chill"}
                    </div>
                    <div className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">
                      {item === "strict" ? "Как на экзамене" : "Пауза и перемотка"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Button size="lg" className="mt-5 w-full" onClick={onStartFull}>
            Начать тест Listening
            <ArrowRight className="h-4 w-4" />
          </Button>

          <div className="mt-4">
            <p className="mb-2 text-center text-xs text-[rgb(var(--muted-foreground))]">Или практикуйте по секциям</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {test.sections.map((section) => (
                <button
                  key={section.sectionNumber}
                  type="button"
                  onClick={() => onStartSection(section.sectionNumber)}
                  className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-elevated))] px-3 py-2 text-sm font-medium text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.4)] hover:bg-[rgb(var(--primary)/0.05)]"
                >
                  Section {section.sectionNumber}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Mode = strict (real exam: single play, no pause, no rewind) | chill (training).
type ListeningMode = "strict" | "chill";
type ListeningSession = { kind: "full" } | { kind: "section"; sectionNumber: number };
type AiMessage = { role: "user" | "assistant"; content: string };
type QuestionAiState = {
  open: boolean;
  loading: boolean;
  error: string | null;
  messages: AiMessage[];
  draft: string;
};

function emptyAiState(): QuestionAiState {
  return { open: false, loading: false, error: null, messages: [], draft: "" };
}

// ─── Audio player ────────────────────────────────────────────────────────────
// In `strict` mode the player enforces real-IELTS rules: audio plays exactly
// once, pause and rewind are disabled. The previous build always rendered a
// "Strict режим" banner but never wired the rules — pausing was possible.

function AudioPlayer({
  audioSources = [],
  duration: durationProp,
  onTimeUpdate,
  onEnded,
  started,
  onStart,
  mode,
}: {
  audioSources: { label: string; url: string }[];
  duration: number;
  onTimeUpdate: (t: number) => void;
  onEnded: () => void;
  started: boolean;
  onStart: () => void;
  mode: ListeningMode;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayNextRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [trackIndex, setTrackIndex] = useState(0);
  const [volume, setVolume] = useState(1);
  const [ended, setEnded] = useState(false);
  const [audioDuration, setAudioDuration] = useState(durationProp);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const duration = audioDuration > 0 ? audioDuration : durationProp;
  const currentSource = audioSources[trackIndex] ?? null;

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const startPlayback = useCallback(async (context: string) => {
    const el = audioRef.current;
    if (!el) return;
    try {
      setLoading(true);
      await el.play();
      autoPlayNextRef.current = false;
      setAudioError(null);
      setPlaying(true);
    } catch (err) {
      console.error(`[${context}]`, err);
      if (err instanceof DOMException && err.name === "AbortError") {
        // The browser can abort play() while swapping the <audio> src. The
        // pending autoplay flag stays true and onCanPlay will retry once the
        // new section is actually ready.
        return;
      }
      setAudioError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Браузер заблокировал воспроизведение. Кликните по плееру ещё раз."
          : "Не удалось запустить аудио. Проверьте соединение."
      );
      autoPlayNextRef.current = false;
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const resetId = window.setTimeout(() => {
      setAudioError(null);
      setPlaying(false);
      setCurrentTime(0);
      setAudioDuration(durationProp);
      setEnded(false);
      setLoading(autoPlayNextRef.current);
    }, 0);
    return () => window.clearTimeout(resetId);
  }, [currentSource?.url, durationProp]);

  function seekTo(seconds: number) {
    if (mode !== "chill") return;
    const el = audioRef.current;
    if (!el || !Number.isFinite(seconds)) return;
    const nextTime = Math.max(0, Math.min(seconds, duration || 0));
    el.currentTime = nextTime;
    setCurrentTime(Math.floor(nextTime));
    onTimeUpdate(Math.floor(nextTime));
    if (ended) setEnded(false);
  }

  function jumpBy(deltaSeconds: number) {
    if (mode !== "chill") return;
    seekTo((audioRef.current?.currentTime ?? currentTime) + deltaSeconds);
  }

  function switchTrack(nextIndex: number) {
    if (mode !== "chill") return;
    if (nextIndex < 0 || nextIndex >= audioSources.length || nextIndex === trackIndex) return;
    autoPlayNextRef.current = playing;
    setAudioError(null);
    setPlaying(false);
    setEnded(false);
    setCurrentTime(0);
    setTrackIndex(nextIndex);
  }

  async function handlePlayPause() {
    setAudioError(null);
    const el = audioRef.current;
    if (!el || !currentSource) {
      setAudioError("Аудио для этого теста недоступно. Выберите другой тест.");
      return;
    }

    // STRICT mode: once playback has started, the user cannot pause —
    // play continues until the audio naturally ends. This matches the
    // real IELTS exam where the recording cannot be stopped or rewound.
    if (mode === "strict" && started && !audioError) {
      // No-op: keep the button visually disabled. Defence-in-depth in case
      // the disabled attribute is bypassed.
      return;
    }

    if (!started) onStart();
    if (ended && mode === "chill") {
      el.currentTime = 0;
      setCurrentTime(0);
      setEnded(false);
    }
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    await startPlayback("audio play");
  }

  // In strict mode the play button must lock once playback has started.
  const playButtonDisabled =
    loading || !currentSource || (mode === "strict" && (ended || (started && !audioError)));

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const chillControlsEnabled = mode === "chill" && Boolean(currentSource);

  return (
    <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5">
      {currentSource && (
        <audio
          key={currentSource.url}
          ref={audioRef}
          src={currentSource.url}
          preload="auto"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setAudioDuration(Math.floor(d));
          }}
          onCanPlay={() => {
            if (autoPlayNextRef.current) void startPlayback("audio autoplay next");
          }}
          onTimeUpdate={(e) => {
            const t = Math.floor(e.currentTarget.currentTime);
            setCurrentTime(t);
            onTimeUpdate(t);
          }}
          onEnded={() => {
            if (trackIndex < audioSources.length - 1) {
              autoPlayNextRef.current = true;
              setPlaying(false);
              setCurrentTime(0);
              setTrackIndex((i) => i + 1);
              return;
            }
            setPlaying(false);
            setEnded(true);
            onEnded();
          }}
          onError={(e) => {
            const err = e.currentTarget.error;
            console.error("[audio error]", err?.code, err?.message);
            autoPlayNextRef.current = false;
            setLoading(false);
            setPlaying(false);
            setAudioError(`Ошибка загрузки аудио для ${currentSource.label} (код ${err?.code ?? "?"})`);
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

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
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
            <span>{currentSource?.label ?? "Audio"} · {formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          {mode === "chill" ? (
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0)}
              step={1}
              value={Math.min(currentTime, Math.max(duration, 0))}
              onChange={(e) => seekTo(Number(e.target.value))}
              disabled={!currentSource}
              aria-label="Перемотать аудио"
              className="h-2 w-full cursor-pointer accent-[rgb(var(--primary))] disabled:cursor-not-allowed disabled:opacity-50"
            />
          ) : (
            <div className="relative h-2 w-full rounded-full bg-[rgb(var(--surface-elevated))] overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-[rgb(var(--primary))] transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {audioSources.length > 1 && !ended && (
            <span className="text-xs text-[rgb(var(--muted-foreground))]">
              Секция {trackIndex + 1} из {audioSources.length}
            </span>
          )}
          {ended && <span className="text-xs text-[rgb(var(--muted-foreground))]">Аудио завершено</span>}
        </div>

        {mode === "chill" && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => switchTrack(trackIndex - 1)}
              disabled={!chillControlsEnabled || trackIndex === 0}
              aria-label="Предыдущая секция"
              title="Предыдущая секция"
              className="h-9 w-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] inline-flex items-center justify-center text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.45)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => jumpBy(-10)}
              disabled={!chillControlsEnabled}
              aria-label="Назад на 10 секунд"
              title="Назад на 10 секунд"
              className="h-9 w-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] inline-flex items-center justify-center text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.45)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => jumpBy(10)}
              disabled={!chillControlsEnabled}
              aria-label="Вперёд на 10 секунд"
              title="Вперёд на 10 секунд"
              className="h-9 w-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] inline-flex items-center justify-center text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.45)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => switchTrack(trackIndex + 1)}
              disabled={!chillControlsEnabled || trackIndex >= audioSources.length - 1}
              aria-label="Следующая секция"
              title="Следующая секция"
              className="h-9 w-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] inline-flex items-center justify-center text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.45)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
        )}

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

// ─── Inline IELTS prompt ─────────────────────────────────────────────────────
// Normalized IELTS-UP listening data stores rich section text in `instruction`
// and questions as "Question N" placeholders. Render answer inputs inside that
// instruction so completion tasks look like a real IELTS question paper.

const ANSWER_MARKER_RE = /\((\d{1,2})\)|\b(\d{1,2})\s*\.\s*/g;

function questionNumber(q: ListeningQuestion, fallbackIndex: number): number {
  const match = q.text.match(/\bQuestion\s+(\d{1,2})\b/i);
  return match ? Number(match[1]) : fallbackIndex + 1;
}

function questionMapForSection(
  questions: ListeningQuestion[],
  firstIndex: number
): Map<number, ListeningQuestion> {
  const map = new Map<number, ListeningQuestion>();
  questions.forEach((q, offset) => {
    map.set(questionNumber(q, firstIndex + offset), q);
  });
  return map;
}

function shouldIgnoreAnswerMarker(line: string, markerIndex: number, marker: string): boolean {
  if (marker.startsWith("(")) return false;
  const before = line.slice(0, markerIndex).trimEnd();
  const prevWord = before.match(/([A-Za-z]+)$/)?.[1]?.toLowerCase();

  // Do not turn section headings into inputs: "SECTION 1. QUESTIONS 1-10".
  if (prevWord === "section") return true;

  // Avoid rare rubric fragments like "Question 1." when they are not blanks.
  if (prevWord === "question" || prevWord === "questions") return true;

  return false;
}

type QuestionRange = { start: number; end: number };

function questionRangeFromLine(line: string): QuestionRange | null {
  if (/^SECTION\b/i.test(line)) return null;
  const match = line.match(/^Questions?\s+(\d{1,2})\s*(?:[-–]\s*|and\s+)(\d{1,2})\b/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return start <= end ? { start, end } : { start: end, end: start };
}

function inlineQuestionIds(
  instruction: string,
  questionsByNumber: Map<number, ListeningQuestion>
): Set<string> {
  const ids = new Set<string>();
  const used = new Set<number>();
  for (const line of displayPromptLines(instruction)) {
    const re = new RegExp(ANSWER_MARKER_RE);
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      const number = Number(match[1] ?? match[2]);
      const q = questionsByNumber.get(number);
      if (!q || used.has(number) || shouldIgnoreAnswerMarker(line, match.index, match[0])) continue;
      used.add(number);
      ids.add(q.id);
    }
  }
  return ids;
}

function rangeFallbackQuestionIds(
  instruction: string,
  questionsByNumber: Map<number, ListeningQuestion>
): Set<string> {
  const inlineIds = inlineQuestionIds(instruction, questionsByNumber);
  const ids = new Set<string>();
  for (const line of displayPromptLines(instruction)) {
    const range = questionRangeFromLine(line);
    if (!range) continue;
    for (let number = range.start; number <= range.end; number += 1) {
      const q = questionsByNumber.get(number);
      if (q && !inlineIds.has(q.id)) ids.add(q.id);
    }
  }
  return ids;
}

function QuestionSupportPanel({
  q,
  number,
  revealed,
  aiState,
  onToggleAnswer,
  onAskAi,
  onAiDraftChange,
}: {
  q: ListeningQuestion;
  number: number;
  revealed: boolean;
  aiState: QuestionAiState;
  onToggleAnswer: () => void;
  onAskAi: (message?: string) => void;
  onAiDraftChange: (value: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onToggleAnswer}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-1.5 font-medium text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.45)]"
        >
          <Eye className="h-3 w-3" />
          Ответ
        </button>
        <button
          type="button"
          onClick={() => onAskAi()}
          disabled={aiState.loading}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-[rgb(var(--primary)/0.25)] bg-[rgb(var(--primary)/0.08)] px-1.5 font-medium text-[rgb(var(--primary))] hover:border-[rgb(var(--primary)/0.55)] disabled:opacity-60"
        >
          {aiState.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
          ИИ
        </button>
      </div>

      {revealed && (
        <div className="rounded-lg border border-[rgb(var(--success)/0.25)] bg-[rgb(var(--success)/0.07)] px-2.5 py-2 text-[rgb(var(--foreground))]">
          <span className="font-semibold text-[rgb(var(--success))]">Ответ {number}: </span>
          <span>{q.expectedText ?? q.answer ?? "—"}</span>
        </div>
      )}

      {aiState.open && (
        <div className="w-full max-w-xl rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 text-left shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-[rgb(var(--foreground))]">
            <MessageCircle className="h-3.5 w-3.5 text-[rgb(var(--primary))]" />
            <span className="font-semibold">Разбор вопроса {number}</span>
          </div>
          {aiState.error && (
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-red-700">
              {aiState.error}
            </div>
          )}
          <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
            {aiState.messages.map((message, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg px-2.5 py-2 leading-relaxed",
                  message.role === "user"
                    ? "ml-6 bg-[rgb(var(--primary)/0.08)] text-[rgb(var(--foreground))]"
                    : "mr-6 bg-[rgb(var(--surface-elevated))] text-[rgb(var(--foreground))]"
                )}
              >
                {message.content}
              </div>
            ))}
            {aiState.loading && (
              <div className="mr-6 inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--surface-elevated))] px-2.5 py-2 text-[rgb(var(--muted-foreground))]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ИИ думает...
              </div>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={aiState.draft}
              onChange={(e) => onAiDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && aiState.draft.trim() && !aiState.loading) {
                  onAskAi(aiState.draft);
                }
              }}
              placeholder="Уточнить вопрос..."
              className="min-w-0 flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 py-2 text-xs focus:outline-none focus:border-[rgb(var(--primary))]"
            />
            <button
              type="button"
              onClick={() => aiState.draft.trim() && onAskAi(aiState.draft)}
              disabled={aiState.loading || !aiState.draft.trim()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[rgb(var(--primary))] text-white disabled:opacity-50"
              aria-label="Отправить уточнение"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InlineAnswerInput({
  q,
  number,
  userAnswer,
  onAnswer,
  showResult,
  revealed = false,
  aiState = emptyAiState(),
  onToggleAnswer,
  onAskAi,
  onAiDraftChange,
}: {
  q: ListeningQuestion;
  number: number;
  userAnswer: number | string | undefined;
  onAnswer: (value: string) => void;
  showResult: boolean;
  revealed?: boolean;
  aiState?: QuestionAiState;
  onToggleAnswer?: () => void;
  onAskAi?: (message?: string) => void;
  onAiDraftChange?: (value: string) => void;
}) {
  const value = typeof userAnswer === "string" ? userAnswer : "";
  const isCorrect = showResult && matchesText(value, q.expectedText);

  return (
    <span className="mx-1 my-1 inline-flex max-w-full flex-col align-middle">
      <span className="inline-flex items-center">
        <span className="inline-flex h-9 items-center rounded-l-lg border border-r-0 border-[rgb(var(--primary)/0.35)] bg-[rgb(var(--primary)/0.1)] px-2 text-sm font-bold text-[rgb(var(--primary))]">
          {number}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onAnswer(e.target.value)}
          disabled={showResult}
          placeholder={`Answer ${number}`}
          data-listening-answer={number}
          className={cn(
            "h-9 w-32 rounded-r-lg border px-2 text-sm font-medium transition-all sm:w-40",
            "border-[rgb(var(--primary)/0.35)] bg-white text-[rgb(var(--foreground))] shadow-sm",
            "focus:outline-none focus:border-[rgb(var(--primary))] focus:bg-[rgb(var(--primary)/0.04)]",
            showResult && (isCorrect
              ? "border-[rgb(var(--success))] bg-[rgb(var(--success)/0.07)]"
              : "border-[rgb(var(--destructive))] bg-[rgb(var(--destructive)/0.07)]")
          )}
        />
      </span>
      {onToggleAnswer && onAskAi && onAiDraftChange && (
        <QuestionSupportPanel
          q={q}
          number={number}
          revealed={revealed}
          aiState={aiState}
          onToggleAnswer={onToggleAnswer}
          onAskAi={onAskAi}
          onAiDraftChange={onAiDraftChange}
        />
      )}
    </span>
  );
}

function QuestionTextWithOptions({ text }: { text: string }) {
  const trimmed = text.trim();
  const questionEnd = trimmed.indexOf("?");
  if (questionEnd === -1) return <>{trimmed}</>;

  const question = trimmed.slice(0, questionEnd + 1);
  const optionText = trimmed.slice(questionEnd + 1).trim();
  if (!optionText) return <>{question}</>;

  const protectedText = optionText.replace(/\b(Mr|Mrs|Ms|Dr|Prof)\.\s*/g, "$1__DOT__ ");
  const options = protectedText
    .split(/\.\s+/)
    .map((part) => part.replace(/__DOT__/g, ".").replace(/\.$/, "").trim())
    .filter(Boolean);

  if (options.length < 2 || options.length > 5) return <>{trimmed}</>;

  return (
    <span className="inline-flex flex-col gap-2 align-top">
      <span>{question}</span>
      <span className="inline-flex flex-wrap gap-x-4 gap-y-1 text-[rgb(var(--foreground))]">
        {options.map((option, i) => (
          <span key={`${option}-${i}`} className="inline-flex gap-1">
            <strong>{String.fromCharCode(65 + i)}.</strong>
            <span>{option}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

function expectedAnswerText(q: ListeningQuestion): string | null {
  if (q.expectedText) return q.expectedText;
  if (q.kind === "mcq" && typeof q.answer === "number") {
    return String.fromCharCode(65 + q.answer);
  }
  return null;
}

function isLetterChoiceQuestion(q: ListeningQuestion): boolean {
  return /^[A-H]$/i.test(expectedAnswerText(q)?.trim() ?? "");
}

function leadingQuestionMarker(line: string): { number: number; rest: string } | null {
  const match = line.match(/^(\((\d{1,2})\)|(\d{1,2})\s*\.\s*)(.*)$/);
  if (!match) return null;
  return {
    number: Number(match[2] ?? match[3]),
    rest: match[4].trim(),
  };
}

function isChoiceInstruction(line: string): boolean {
  return /\bchoose\b/i.test(line) && /\bletters?\b/i.test(line);
}

function isSingleChoiceInstruction(line: string): boolean {
  return /\bchoose\s+the\s+correct\s+letters?\b/i.test(line)
    || /\bchoose\s+the\s+correct\s+(?:answer|option)\b/i.test(line);
}

function splitChoiceOptions(raw: string): string[] {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || questionRangeFromLine(text) || isChoiceInstruction(text)) return [];

  const explicitLabels = [...text.matchAll(/(?:^|\s)([A-H])[\s).:-]+(?=\S)/g)];
  if (explicitLabels.length >= 2) {
    return explicitLabels
      .map((match, index) => {
        const start = (match.index ?? 0) + match[0].length;
        const end = explicitLabels[index + 1]?.index ?? text.length;
        return text.slice(start, end).trim();
      })
      .filter(Boolean);
  }

  const protectedText = text.replace(/\b(Mr|Mrs|Ms|Dr|Prof)\.\s*/g, "$1__DOT__ ");
  const sentenceParts = protectedText
    .split(/\.\s+/)
    .map((part) => part.replace(/__DOT__/g, ".").replace(/\.$/, "").trim())
    .filter(Boolean);
  if (sentenceParts.length >= 2 && sentenceParts.length <= 5) return sentenceParts;

  if (/^\d+%\s+\d+%\s+\d+/.test(text)) {
    return text.split(/\s+(?=\d+%|\d+\s+million\b)/).filter(Boolean);
  }

  if (/^\d{1,2}:\d{2}\s*(?:AM|PM)\b/i.test(text)) {
    const timeOptions = text
      .split(/\s+(?=\d{1,2}:\d{2}\s*(?:AM|PM)\b)/i)
      .map((part) => part.trim())
      .filter(Boolean);
    if (timeOptions.length >= 2 && timeOptions.length <= 5) return timeOptions;
  }

  const punctuatedStarters = ["No,", "Yes,", "Mr.", "Mrs.", "Ms.", "Dr."];
  const wordStarters = [
    "By", "After", "While", "Scientists", "People", "They", "Their", "It",
    "Species", "Receptors", "Some", "Pain", "Beauty", "Continuousness",
    "Anesthesia", "On", "Only", "The", "Pharmacies", "Letting", "Asking",
    "Meeting", "Continuous", "Near", "At",
  ];
  const punctuatedPattern = punctuatedStarters
    .map((starter) => starter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const wordPattern = wordStarters
    .map((starter) => starter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const starterParts = text
    .split(new RegExp(`\\s+(?=(?:${punctuatedPattern}|${wordPattern}\\b))`, "g"))
    .map((part) => part.trim())
    .filter(Boolean);
  if (starterParts.length >= 2 && starterParts.length <= 5) return starterParts;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 5 && words.every((word) => /^[A-Z][A-Za-z’'-]+$/.test(word))) {
    return words;
  }

  return [];
}

function sentenceParts(raw: string): string[] {
  return raw
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof)\.\s*/g, "$1__DOT__ ")
    .split(/\.\s+/)
    .map((part) => part.replace(/__DOT__/g, ".").replace(/\.$/, "").trim())
    .filter(Boolean);
}

function splitFirstOptionFromStem(firstSentence: string): { questionText: string; firstOption: string } | null {
  const patterns = [
    /(.*\b(?:needed to|need to|at least|with)\s+)(.+)$/i,
    /(.*\bare:\s*)(.+)$/i,
    /(.*\bis\s+)(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = firstSentence.match(pattern);
    if (match?.[1] && match[2]) {
      return {
        questionText: match[1].trim(),
        firstOption: match[2].trim(),
      };
    }
  }
  return null;
}

function splitInlineChoiceQuestion(raw: string): { questionText: string; optionText: string } | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const questionEnd = text.indexOf("?");
  if (questionEnd !== -1) {
    const questionText = text.slice(0, questionEnd + 1).trim();
    const optionText = text.slice(questionEnd + 1).trim();
    return splitChoiceOptions(optionText).length >= 2 ? { questionText, optionText } : null;
  }

  const parts = sentenceParts(text);
  if (parts.length >= 5) {
    const optionParts = parts.slice(-4);
    const optionLeadSplit = splitFirstOptionFromStem(optionParts[0]);
    if (optionLeadSplit) {
      const questionPrefix = parts.slice(0, -4).join(". ");
      const questionText = `${questionPrefix}. ${optionLeadSplit.questionText}`.trim();
      return {
        questionText,
        optionText: [optionLeadSplit.firstOption, ...optionParts.slice(1)].join(". "),
      };
    }
    return {
      questionText: `${parts.slice(0, -4).join(". ")}.`,
      optionText: optionParts.join(". "),
    };
  }

  if (parts.length === 4) {
    const split = splitFirstOptionFromStem(parts[0]);
    if (!split) return null;
    return {
      questionText: split.questionText,
      optionText: [split.firstOption, ...parts.slice(1)].join(". "),
    };
  }

  return null;
}

function isStandaloneChoiceOptionLine(line: string): boolean {
  return splitChoiceOptions(line).length >= 2
    && !leadingQuestionMarker(line)
    && !/^SECTION\b/i.test(line)
    && !/^Questions?\b/i.test(line)
    && !/^Write\b/i.test(line)
    && !/^Answer\b/i.test(line)
    && !/^Complete\b/i.test(line)
    && !/^Label\b/i.test(line);
}

function nextUnusedInRange(
  range: QuestionRange | null,
  questionsByNumber: Map<number, ListeningQuestion>,
  usedNumbers: Set<number>
): { number: number; q: ListeningQuestion } | null {
  if (!range) return null;
  for (let number = range.start; number <= range.end; number += 1) {
    const q = questionsByNumber.get(number);
    if (q && !usedNumbers.has(number)) return { number, q };
  }
  return null;
}

function MultipleChoicePrompt({
  q,
  number,
  questionText,
  optionText,
  answers,
  revealedAnswers,
  aiStates,
  onAnswer,
  onToggleAnswer,
  onAskAi,
  onAiDraftChange,
  showResult,
}: {
  q: ListeningQuestion;
  number: number;
  questionText: string;
  optionText: string;
  answers: Record<string, number | string>;
  revealedAnswers: Set<string>;
  aiStates: Record<string, QuestionAiState>;
  onAnswer: (qId: string, value: string) => void;
  onToggleAnswer: (qId: string) => void;
  onAskAi: (q: ListeningQuestion, number: number, message?: string) => void;
  onAiDraftChange: (qId: string, value: string) => void;
  showResult: boolean;
}) {
  const options = splitChoiceOptions(optionText);
  const currentAnswer = answers[q.id];
  const current = typeof currentAnswer === "string" ? currentAnswer.trim().toUpperCase() : "";

  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-elevated))] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <p className="min-w-0 text-sm font-medium leading-6 text-[rgb(var(--foreground))]">
          <span className="mr-1.5 font-bold text-[rgb(var(--primary))]">{number}.</span>
          {questionText || "Choose the correct letter."}
        </p>
        <InlineAnswerInput
          q={q}
          number={number}
          userAnswer={answers[q.id]}
          onAnswer={(value) => onAnswer(q.id, value.toUpperCase())}
          showResult={showResult}
          revealed={revealedAnswers.has(q.id)}
          aiState={aiStates[q.id] ?? emptyAiState()}
          onToggleAnswer={() => onToggleAnswer(q.id)}
          onAskAi={(message) => onAskAi(q, number, message)}
          onAiDraftChange={(value) => onAiDraftChange(q.id, value)}
        />
      </div>
      <div className="mt-3 grid gap-2">
        {options.map((option, index) => {
          const label = String.fromCharCode(65 + index);
          const selected = current === label;
          return (
            <button
              key={`${number}-${label}-${option}`}
              type="button"
              disabled={showResult}
              onClick={() => onAnswer(q.id, label)}
              className={cn(
                "flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm leading-5 transition-colors",
                selected
                  ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.09)]"
                  : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:border-[rgb(var(--primary)/0.4)]"
              )}
            >
              <span className="font-bold text-[rgb(var(--primary))]">{label}.</span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TextAnswerPrompt({
  q,
  number,
  questionText,
  answers,
  revealedAnswers,
  aiStates,
  onAnswer,
  onToggleAnswer,
  onAskAi,
  onAiDraftChange,
  showResult,
}: {
  q: ListeningQuestion;
  number: number;
  questionText: string;
  answers: Record<string, number | string>;
  revealedAnswers: Set<string>;
  aiStates: Record<string, QuestionAiState>;
  onAnswer: (qId: string, value: string) => void;
  onToggleAnswer: (qId: string) => void;
  onAskAi: (q: ListeningQuestion, number: number, message?: string) => void;
  onAiDraftChange: (qId: string, value: string) => void;
  showResult: boolean;
}) {
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-elevated))] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <p className="min-w-0 text-sm font-medium leading-6 text-[rgb(var(--foreground))]">
          <span className="mr-1.5 font-bold text-[rgb(var(--primary))]">{number}.</span>
          {questionText || `Question ${number}`}
        </p>
        <InlineAnswerInput
          q={q}
          number={number}
          userAnswer={answers[q.id]}
          onAnswer={(value) => onAnswer(q.id, value)}
          showResult={showResult}
          revealed={revealedAnswers.has(q.id)}
          aiState={aiStates[q.id] ?? emptyAiState()}
          onToggleAnswer={() => onToggleAnswer(q.id)}
          onAskAi={(message) => onAskAi(q, number, message)}
          onAiDraftChange={(value) => onAiDraftChange(q.id, value)}
        />
      </div>
    </div>
  );
}

function lineHasLaterAnswerMarker({
  line,
  startIndex,
  questionsByNumber,
  usedNumbers,
}: {
  line: string;
  startIndex: number;
  questionsByNumber: Map<number, ListeningQuestion>;
  usedNumbers: Set<number>;
}): boolean {
  const rest = line.slice(startIndex);
  const re = new RegExp(ANSWER_MARKER_RE);
  let match: RegExpExecArray | null;
  while ((match = re.exec(rest)) !== null) {
    const number = Number(match[1] ?? match[2]);
    const fullIndex = startIndex + match.index;
    if (
      questionsByNumber.has(number)
      && !usedNumbers.has(number)
      && !shouldIgnoreAnswerMarker(line, fullIndex, match[0])
    ) {
      return true;
    }
  }
  return false;
}

function shouldRenderLeadingMarkerAsCard({
  line,
  rest,
  afterMarkerIndex,
  questionsByNumber,
  usedNumbers,
}: {
  line: string;
  rest: string;
  afterMarkerIndex: number;
  questionsByNumber: Map<number, ListeningQuestion>;
  usedNumbers: Set<number>;
}): boolean {
  if (!rest) return false;
  if (/^[a-z]/.test(rest)) return false;
  if (/^[A-Z][A-Z\s’'/-]{3,}\b/.test(rest)) return false;
  return !lineHasLaterAnswerMarker({ line, startIndex: afterMarkerIndex, questionsByNumber, usedNumbers });
}

function renderPromptLine({
  line,
  questionsByNumber,
  usedNumbers,
  answers,
  revealedAnswers,
  aiStates,
  onAnswer,
  onToggleAnswer,
  onAskAi,
  onAiDraftChange,
  showResult,
}: {
  line: string;
  questionsByNumber: Map<number, ListeningQuestion>;
  usedNumbers: Set<number>;
  answers: Record<string, number | string>;
  onAnswer: (qId: string, value: string) => void;
  revealedAnswers: Set<string>;
  aiStates: Record<string, QuestionAiState>;
  onToggleAnswer: (qId: string) => void;
  onAskAi: (q: ListeningQuestion, number: number, message?: string) => void;
  onAiDraftChange: (qId: string, value: string) => void;
  showResult: boolean;
}): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = new RegExp(ANSWER_MARKER_RE);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(line)) !== null) {
    const number = Number(match[1] ?? match[2]);
    const q = questionsByNumber.get(number);
    const ignored =
      !q || usedNumbers.has(number) || shouldIgnoreAnswerMarker(line, match.index, match[0]);

    if (ignored) continue;

    if (match.index === 0) {
      const rest = line.slice(re.lastIndex).trim();
      if (
        shouldRenderLeadingMarkerAsCard({
          line,
          rest,
          afterMarkerIndex: re.lastIndex,
          questionsByNumber,
          usedNumbers,
        })
      ) {
        usedNumbers.add(number);
        return [
          <TextAnswerPrompt
            key={`${q.id}-${number}-text-card`}
            q={q}
            number={number}
            questionText={rest}
            answers={answers}
            revealedAnswers={revealedAnswers}
            aiStates={aiStates}
            onAnswer={onAnswer}
            onToggleAnswer={onToggleAnswer}
            onAskAi={onAskAi}
            onAiDraftChange={onAiDraftChange}
            showResult={showResult}
          />
        ];
      }
    }

    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    parts.push(
      <InlineAnswerInput
        key={`${q.id}-${number}`}
        q={q}
        number={number}
        userAnswer={answers[q.id]}
        onAnswer={(value) => onAnswer(q.id, value)}
        showResult={showResult}
        revealed={revealedAnswers.has(q.id)}
        aiState={aiStates[q.id] ?? emptyAiState()}
        onToggleAnswer={() => onToggleAnswer(q.id)}
        onAskAi={(message) => onAskAi(q, number, message)}
        onAiDraftChange={(value) => onAiDraftChange(q.id, value)}
      />
    );
    usedNumbers.add(number);
    lastIndex = re.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [line];
}

function promptLineClass(line: string): string {
  if (/^SECTION\s+\d/i.test(line)) {
    return "text-xl font-bold uppercase tracking-wide text-[rgb(var(--foreground))]";
  }
  if (
    line.length < 80
    && line === line.toUpperCase()
    && /[A-Z]/.test(line)
    && !/\bQUESTIONS?\b/.test(line)
  ) {
    return "pt-2 text-base font-semibold text-[rgb(var(--foreground))]";
  }
  if (/^Questions?\s+\d/i.test(line)) {
    return "pt-3 text-sm font-semibold text-[rgb(var(--foreground))]";
  }
  return "text-sm leading-8 text-[rgb(var(--foreground))]";
}

function mergeDanglingAnswerLines(lines: string[]): string[] {
  const merged: string[] = [];
  for (const line of lines) {
    const previous = merged[merged.length - 1];
    const currentStartsWithAnswer = /^\d{1,2}\.\s+/.test(line);
    const previousLooksDangling =
      previous
      && !/^SECTION\b/i.test(previous)
      && !/^Questions?\b/i.test(previous)
      && !leadingQuestionMarker(previous)
      && !/[.!?:;)]$/.test(previous);

    if (currentStartsWithAnswer && previousLooksDangling) {
      merged[merged.length - 1] = `${previous} ${line}`;
    } else {
      merged.push(line);
    }
  }
  return merged;
}

function displayPromptLines(instruction: string): string[] {
  const lines = instruction
    .split("\n")
    .flatMap((line) => {
      const sectionSplit = line
        .replace(/\b(SECTION\s+\d{1,2}\.\s+QUESTIONS?\s+\d{1,2}\s*[-–]\s*\d{1,2})\b/gi, "\n$1\n")
        .split("\n");
      return sectionSplit.flatMap((part) => {
        const withQuestionGroups = /^SECTION\s+\d{1,2}\.\s+QUESTIONS?/i.test(part)
          ? part
          : part
            .replace(/\s*(Questions?\s+\d{1,2}\s*[-–]\s*\d{1,2}\b)\s*/g, "\n$1\n")
            .replace(/\s*(Questions?\s+\d{1,2}\s+and\s+\d{1,2}\b)\s*/g, "\n$1\n");
        return withQuestionGroups
          .replace(/\s+(\d{1,2}\.\s+(?=(?:What|Which|Who|Where|When|Why|How)\b))/g, "\n$1")
          .replace(/\s+(\d{1,2}\s*\.\s+(?=[A-Z][a-z]))/g, "\n$1")
          .replace(/\s+((?:[A-Z][A-Z’'/-]*\s+){1,}[A-Z][A-Z’'/-]*)(?=\s+[A-Z][a-z]|\s+\d{1,2}\b)/g, "\n$1")
          .split("\n");
      });
    })
    .map((line) => line.trim())
    .filter(Boolean);
  return mergeDanglingAnswerLines(lines);
}

function InlinePromptDocument({
  instruction,
  sectionQuestions,
  firstIndex,
  answers,
  revealedAnswers,
  aiStates,
  onAnswer,
  onToggleAnswer,
  onAskAi,
  onAiDraftChange,
  showResult,
}: {
  instruction: string;
  sectionQuestions: ListeningQuestion[];
  firstIndex: number;
  answers: Record<string, number | string>;
  onAnswer: (qId: string, value: string) => void;
  revealedAnswers: Set<string>;
  aiStates: Record<string, QuestionAiState>;
  onToggleAnswer: (qId: string) => void;
  onAskAi: (q: ListeningQuestion, number: number, message?: string) => void;
  onAiDraftChange: (qId: string, value: string) => void;
  showResult: boolean;
}) {
  const questionsByNumber = useMemo(
    () => questionMapForSection(sectionQuestions, firstIndex),
    [sectionQuestions, firstIndex]
  );
  const usedNumbers = new Set<number>();
  const lines = displayPromptLines(instruction);
  const rows: ReactNode[] = [];
  let activeRange: QuestionRange | null = null;
  let lastChoiceInstruction: string | null = null;

  function addFallbackForRange(
    range: QuestionRange | null,
    key: string,
    choiceInstruction: string | null = lastChoiceInstruction
  ) {
    if (!range) return;
    const items: { q: ListeningQuestion; index: number }[] = [];
    for (let number = range.start; number <= range.end; number += 1) {
      const q = questionsByNumber.get(number);
      if (!q || usedNumbers.has(number)) continue;
      if (choiceInstruction && isSingleChoiceInstruction(choiceInstruction) && isLetterChoiceQuestion(q)) {
        usedNumbers.add(number);
        continue;
      }
      items.push({ q, index: number - 1 });
      usedNumbers.add(number);
    }
    if (items.length === 0) return;
    rows.push(
      <InlineAnswerGrid
        key={key}
        items={items}
        answers={answers}
        revealedAnswers={revealedAnswers}
        aiStates={aiStates}
        onAnswer={onAnswer}
        onToggleAnswer={onToggleAnswer}
        onAskAi={onAskAi}
        onAiDraftChange={onAiDraftChange}
        showResult={showResult}
      />
    );
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const nextRange = questionRangeFromLine(line);
    if (nextRange) {
      addFallbackForRange(activeRange, `range-fallback-${activeRange?.start}-${i}`);
      activeRange = nextRange;
      lastChoiceInstruction = null;
    }

    if (isChoiceInstruction(line)) {
      lastChoiceInstruction = line;
    }

    const marker = leadingQuestionMarker(line);
    const markerQuestion = marker ? questionsByNumber.get(marker.number) : null;
    const nextLine = lines[i + 1] ?? "";
    const inlineChoice =
      marker && markerQuestion && isLetterChoiceQuestion(markerQuestion)
        ? splitInlineChoiceQuestion(marker.rest)
        : null;
    if (
      marker
      && markerQuestion
      && !usedNumbers.has(marker.number)
      && inlineChoice
    ) {
      usedNumbers.add(marker.number);
      rows.push(
        <MultipleChoicePrompt
          key={`${markerQuestion.id}-${marker.number}-inline-choices`}
          q={markerQuestion}
          number={marker.number}
          questionText={inlineChoice.questionText}
          optionText={inlineChoice.optionText}
          answers={answers}
          revealedAnswers={revealedAnswers}
          aiStates={aiStates}
          onAnswer={onAnswer}
          onToggleAnswer={onToggleAnswer}
          onAskAi={onAskAi}
          onAiDraftChange={onAiDraftChange}
          showResult={showResult}
        />
      );
      continue;
    }

    if (
      marker
      && markerQuestion
      && !usedNumbers.has(marker.number)
      && isLetterChoiceQuestion(markerQuestion)
      && isStandaloneChoiceOptionLine(nextLine)
    ) {
      usedNumbers.add(marker.number);
      rows.push(
        <MultipleChoicePrompt
          key={`${markerQuestion.id}-${marker.number}-choices`}
          q={markerQuestion}
          number={marker.number}
          questionText={marker.rest}
          optionText={nextLine}
          answers={answers}
          revealedAnswers={revealedAnswers}
          aiStates={aiStates}
          onAnswer={onAnswer}
          onToggleAnswer={onToggleAnswer}
          onAskAi={onAskAi}
          onAiDraftChange={onAiDraftChange}
          showResult={showResult}
        />
      );
      i += 1;
      continue;
    }

    const missingChoice = nextUnusedInRange(activeRange, questionsByNumber, usedNumbers);
    if (
      lastChoiceInstruction
      && isSingleChoiceInstruction(lastChoiceInstruction)
      && missingChoice
      && isLetterChoiceQuestion(missingChoice.q)
      && isStandaloneChoiceOptionLine(line)
    ) {
      usedNumbers.add(missingChoice.number);
      rows.push(
        <MultipleChoicePrompt
          key={`${missingChoice.q.id}-${missingChoice.number}-missing-choice`}
          q={missingChoice.q}
          number={missingChoice.number}
          questionText="Choose the correct letter."
          optionText={line}
          answers={answers}
          revealedAnswers={revealedAnswers}
          aiStates={aiStates}
          onAnswer={onAnswer}
          onToggleAnswer={onToggleAnswer}
          onAskAi={onAskAi}
          onAiDraftChange={onAiDraftChange}
          showResult={showResult}
        />
      );
      continue;
    }

    rows.push(
      <div key={`${line}-${i}`} className={promptLineClass(line)}>
        {renderPromptLine({
          line,
          questionsByNumber,
          usedNumbers,
          answers,
          revealedAnswers,
          aiStates,
          onAnswer,
          onToggleAnswer,
          onAskAi,
          onAiDraftChange,
          showResult,
        })}
      </div>
    );
  }
  if (activeRange) {
    addFallbackForRange(activeRange, "range-fallback-end");
  }

  return (
    <div className="rounded-xl bg-[rgb(var(--surface))]">
      <div className="flex flex-col gap-4">{rows}</div>
    </div>
  );
}

function InlineAnswerGrid({
  items,
  answers,
  revealedAnswers,
  aiStates,
  onAnswer,
  onToggleAnswer,
  onAskAi,
  onAiDraftChange,
  showResult,
}: {
  items: { q: ListeningQuestion; index: number }[];
  answers: Record<string, number | string>;
  onAnswer: (qId: string, value: string) => void;
  revealedAnswers: Set<string>;
  aiStates: Record<string, QuestionAiState>;
  onToggleAnswer: (qId: string) => void;
  onAskAi: (q: ListeningQuestion, number: number, message?: string) => void;
  onAiDraftChange: (qId: string, value: string) => void;
  showResult: boolean;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map(({ q, index }) => (
        <TextAnswerPrompt
          key={q.id}
          q={q}
          number={questionNumber(q, index)}
          questionText={/^Question\s+\d+$/i.test(q.text) ? "" : q.text}
          answers={answers}
          revealedAnswers={revealedAnswers}
          aiStates={aiStates}
          onAnswer={onAnswer}
          onToggleAnswer={onToggleAnswer}
          onAskAi={onAskAi}
          onAiDraftChange={onAiDraftChange}
          showResult={showResult}
        />
      ))}
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
  revealed = false,
  aiState = emptyAiState(),
  onToggleAnswer,
  onAskAi,
  onAiDraftChange,
}: {
  q: ListeningQuestion;
  index: number;
  userAnswer: number | string | undefined;
  onAnswer: (value: number | string) => void;
  showResult: boolean;
  revealed?: boolean;
  aiState?: QuestionAiState;
  onToggleAnswer?: () => void;
  onAskAi?: (message?: string) => void;
  onAiDraftChange?: (value: string) => void;
}) {
  // Mark MCQ correct against q.answer; text correct against q.expectedText
  const isMcqCorrect = q.kind === "mcq" && typeof userAnswer === "number" && userAnswer === q.answer;
  const isTextCorrect =
    q.kind === "text" && typeof userAnswer === "string" && matchesText(userAnswer, q.expectedText);

  return (
    <div className="flex flex-col gap-3 pb-6 border-b border-[rgb(var(--border))] last:border-0 last:pb-0">
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
      {onToggleAnswer && onAskAi && onAiDraftChange && (
        <div className="ml-8">
          <QuestionSupportPanel
            q={q}
            number={index + 1}
            revealed={revealed}
            aiState={aiState}
            onToggleAnswer={onToggleAnswer}
            onAskAi={onAskAi}
            onAiDraftChange={onAiDraftChange}
          />
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function ListeningTestPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTestId = searchParams.get("id");
  const [test, setTest] = useState<ListeningTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(() => new Set());
  const [aiStates, setAiStates] = useState<Record<string, QuestionAiState>>({});
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState<ListeningSession | null>(null);
  const [audioStarted, setAudioStarted] = useState(false);
  const [audioEnded, setAudioEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // STRICT = real-exam rules (one-shot audio, no pause/rewind).
  // CHILL  = training mode (full control over the audio).
  // Default to strict — that's the value of an IELTS prep platform.
  const [mode, setMode] = useState<ListeningMode>("strict");
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
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

        let raw = selectedTestId
          ? await getListeningTest(sb, selectedTestId)
          : user ? await getNextListening(sb, user.id) : null;
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
  }, [selectedTestId]);

  // ── Derived ──
  const fullTestQuestions = useMemo<ListeningQuestion[]>(
    () => (test ? test.sections.flatMap((s) => s.questions) : []),
    [test]
  );
  const activeSections = useMemo(
    () => {
      if (!test || !session) return [];
      return session.kind === "section"
        ? test.sections.filter((section) => section.sectionNumber === session.sectionNumber)
        : test.sections;
    },
    [test, session]
  );
  const allQuestions = useMemo<ListeningQuestion[]>(
    () => activeSections.flatMap((s) => s.questions),
    [activeSections]
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

  const startSession = useCallback(async (nextSession: ListeningSession) => {
    if (userIdRef.current && test?.id !== "fallback") {
      const sb = createClient();
      const allowed = await checkDailyLimit(sb, userIdRef.current, "listening");
      if (!allowed) {
        router.push("/pricing");
        return;
      }
    }
    setAnswers({});
    setRevealedAnswers(new Set());
    setAiStates({});
    setSubmitted(false);
    setLimitNotice(null);
    setAudioStarted(false);
    setAudioEnded(false);
    setCurrentTime(0);
    setSession(nextSession);
  }, [router, test?.id]);

  const toggleRevealedAnswer = useCallback((qId: string) => {
    setRevealedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  }, []);

  const updateAiDraft = useCallback((qId: string, value: string) => {
    setAiStates((prev) => ({
      ...prev,
      [qId]: { ...(prev[qId] ?? emptyAiState()), draft: value, open: true },
    }));
  }, []);

  const askQuestionAi = useCallback(async (
    q: ListeningQuestion,
    number: number,
    message?: string
  ) => {
    if (!test) return;
    const section = test.sections.find((s) => s.questions.some((item) => item.id === q.id));
    const current = aiStates[q.id] ?? emptyAiState();
    const trimmedMessage = message?.trim();

    if (!trimmedMessage && current.open && !current.loading) {
      setAiStates((prev) => ({
        ...prev,
        [q.id]: { ...(prev[q.id] ?? emptyAiState()), open: false },
      }));
      return;
    }

    if (!trimmedMessage && current.messages.length > 0) {
      setAiStates((prev) => ({
        ...prev,
        [q.id]: { ...(prev[q.id] ?? emptyAiState()), open: true },
      }));
      return;
    }

    const outgoingMessages: AiMessage[] = trimmedMessage
      ? [...current.messages, { role: "user", content: trimmedMessage }]
      : current.messages;

    setAiStates((prev) => ({
      ...prev,
      [q.id]: {
        ...(prev[q.id] ?? emptyAiState()),
        open: true,
        loading: true,
        error: null,
        draft: "",
        messages: outgoingMessages,
      },
    }));

    try {
      const res = await fetch("/api/ai/listening-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionNumber: number,
          questionText: q.text,
          correctAnswer: q.expectedText ?? q.answer ?? "",
          userAnswer: answers[q.id] ?? "",
          sectionPrompt: section?.questions[0]?.instruction ?? q.instruction,
          messages: outgoingMessages,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "ИИ сейчас недоступен.");
      }
      const explanation = String(data.explanation || "").trim();
      setAiStates((prev) => ({
        ...prev,
        [q.id]: {
          ...(prev[q.id] ?? emptyAiState()),
          open: true,
          loading: false,
          error: null,
          messages: [...outgoingMessages, { role: "assistant", content: explanation || "Нет ответа." }],
          draft: "",
        },
      }));
    } catch (err) {
      setAiStates((prev) => ({
        ...prev,
        [q.id]: {
          ...(prev[q.id] ?? emptyAiState()),
          open: true,
          loading: false,
          error: err instanceof Error ? err.message : "Не удалось получить объяснение.",
          messages: outgoingMessages,
          draft: trimmedMessage ?? "",
        },
      }));
    }
  }, [aiStates, answers, test]);

  const handleSubmit = useCallback(async () => {
    if (!test) return;
    setSubmitted(true);
    if (userIdRef.current && test.id !== "fallback") {
      try {
        const sb = createClient();
        const allowed = await checkDailyLimit(sb, userIdRef.current, "listening");
        if (!allowed) {
          setLimitNotice("Бесплатный лимит на сегодня уже использован. Результат показан, но попытка не сохранена.");
          return;
        }
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
        await incrementUsage(sb, userIdRef.current, "listening");
      } catch { /* non-fatal */ }
    }
  }, [test, answers, allQuestions, totalQ, currentTime]);

  if (loading || !test) return <ListeningSkeleton />;
  if (!session) {
    return (
      <ListeningStartScreen
        test={test}
        mode={mode}
        onModeChange={setMode}
        onStartFull={() => startSession({ kind: "full" })}
        onStartSection={(sectionNumber) => startSession({ kind: "section", sectionNumber })}
      />
    );
  }

  const audioSources = activeSections
    .map((section) => ({
      label: `Section ${section.sectionNumber}`,
      url: section.audioUrl ?? (section.sectionNumber === 1 ? test.audioUrl : null),
    }))
    .filter((source): source is { label: string; url: string } => Boolean(source.url));

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
            {limitNotice && (
              <div className="mt-1 rounded-xl border border-[rgb(var(--warning)/0.25)] bg-[rgb(var(--warning)/0.08)] px-3 py-2 text-xs text-[rgb(var(--warning))]">
                {limitNotice}
              </div>
            )}
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
            <Button
              className="flex-1"
              onClick={() => {
                setSession(null);
                setSubmitted(false);
                setAnswers({});
                setRevealedAnswers(new Set());
                setAiStates({});
              }}
            >
              К выбору режима
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active test ──
  return (
    <div className="min-h-screen bg-[rgb(var(--background))]">
      <header className="sticky top-0 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))] z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] shrink-0">
            <ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Headphones className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="text-sm font-medium truncate">
              {session.kind === "section"
                ? `${test.title} · Section ${session.sectionNumber}`
                : test.title}
            </span>
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

      <div>
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
          <AudioPlayer
            audioSources={audioSources}
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
            <div className="flex flex-col gap-8">
              {activeSections.map((section) => {
                const firstIndex = fullTestQuestions.findIndex((q) => q.id === section.questions[0]?.id);
                const safeFirstIndex = Math.max(firstIndex, 0);
                const instruction = section.questions[0]?.instruction;
                const questionsByNumber = questionMapForSection(section.questions, safeFirstIndex);
                const inlineIds = instruction
                  ? inlineQuestionIds(instruction, questionsByNumber)
                  : new Set<string>();
                const rangeFallbackIds = instruction
                  ? rangeFallbackQuestionIds(instruction, questionsByNumber)
                  : new Set<string>();
                const handledIds = new Set([...inlineIds, ...rangeFallbackIds]);
                const remainingQuestions = section.questions
                  .map((q, offset) => ({ q, index: safeFirstIndex + offset }))
                  .filter(({ q }) => !handledIds.has(q.id));
                const remainingArePlaceholders = remainingQuestions.every(
                  ({ q }) => q.kind === "text" && /^Question\s+\d+$/i.test(q.text)
                );
                return (
                  <section key={section.sectionNumber} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-sm text-[rgb(var(--foreground))]">
                          Section {section.sectionNumber}
                        </h3>
                        <span className="text-xs text-[rgb(var(--muted-foreground))]">
                          Questions {safeFirstIndex + 1}–{safeFirstIndex + section.questions.length}
                        </span>
                      </div>
                      {instruction && (
                        <InlinePromptDocument
                          instruction={instruction}
                          sectionQuestions={section.questions}
                          firstIndex={safeFirstIndex}
                          answers={answers}
                          revealedAnswers={revealedAnswers}
                          aiStates={aiStates}
                          onAnswer={handleAnswer}
                          onToggleAnswer={toggleRevealedAnswer}
                          onAskAi={askQuestionAi}
                          onAiDraftChange={updateAiDraft}
                          showResult={false}
                        />
                      )}
                    </div>
                    {remainingQuestions.length > 0 && (
                      remainingArePlaceholders ? (
                        <InlineAnswerGrid
                          items={remainingQuestions}
                          answers={answers}
                          revealedAnswers={revealedAnswers}
                          aiStates={aiStates}
                          onAnswer={handleAnswer}
                          onToggleAnswer={toggleRevealedAnswer}
                          onAskAi={askQuestionAi}
                          onAiDraftChange={updateAiDraft}
                          showResult={false}
                        />
                      ) : (
                        <div className="flex flex-col gap-6">
                          {remainingQuestions.map(({ q, index }) => (
                            <QuestionItem
                              key={q.id}
                              q={q}
                              index={index}
                              userAnswer={answers[q.id]}
                              onAnswer={(v) => handleAnswer(q.id, v)}
                              showResult={false}
                              revealed={revealedAnswers.has(q.id)}
                              aiState={aiStates[q.id] ?? emptyAiState()}
                              onToggleAnswer={() => toggleRevealedAnswer(q.id)}
                              onAskAi={(message) => askQuestionAi(q, index + 1, message)}
                              onAiDraftChange={(value) => updateAiDraft(q.id, value)}
                            />
                          ))}
                        </div>
                      )
                    )}
                  </section>
                );
              })}
            </div>
            <Button
              size="lg"
              className="w-full mt-6"
              onClick={handleSubmit}
            >
              <Flag className="w-4 h-4" />
              Сдать ({answeredCount}/{totalQ})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ListeningTestPage() {
  return (
    <Suspense fallback={<ListeningSkeleton />}>
      <ListeningTestPageContent />
    </Suspense>
  );
}
