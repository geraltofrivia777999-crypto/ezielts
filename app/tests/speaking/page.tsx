"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Mic2,
  Square,
  CheckCircle2,
  Clock,
  Sparkles,
  RotateCcw,
  BookOpen,
  Loader2,
  AlertCircle,
  ChevronDown,
  MessageCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSpeakingTopics } from "@/lib/supabase/queries";
import type { Database } from "@/lib/supabase/types";

type SpeakingTopic = Database["public"]["Tables"]["speaking_topics"]["Row"];

// ─── Feedback types ────────────────────────────────────────────────────────────

interface SpeakingFeedback {
  overall_band: number;
  fluency_coherence: number;
  lexical_resource: number;
  grammatical_range: number;
  pronunciation: number;
  transcript: string;
  summary: string;
  strengths: string[];
  improvements: Array<{ issue: string; example: string; suggestion: string }>;
  model_phrases: string[];
}

// ─── Fallback topics ──────────────────────────────────────────────────────────

const FALLBACK_TOPICS = [
  {
    id: "p1",
    part: 1 as const,
    topic_text: "Tell me about yourself and your studies or work.",
    questions: [
      "Do you work or are you a student?",
      "What do you enjoy most about your studies or work?",
      "Do you like reading? What kind of books do you prefer?",
      "How do you usually spend your weekends?",
    ],
  },
  {
    id: "p2",
    part: 2 as const,
    topic_text: "Describe a book you have read recently that you found interesting.",
    cue_card_points: ["What the book was about", "Why you decided to read it", "What you found most interesting", "Whether you would recommend it"],
  },
  {
    id: "p3",
    part: 3 as const,
    topic_text: "Let's discuss reading and technology.",
    questions: [
      "Do you think reading habits have changed in recent years?",
      "What are the advantages of e-books compared to traditional books?",
      "How important is it for children to develop reading habits?",
    ],
  },
];

// ─── Waveform animation ───────────────────────────────────────────────────────

function WaveformBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1 h-10">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className={cn("w-1 rounded-full transition-all", active ? "bg-[rgb(var(--primary))]" : "bg-[rgb(var(--border))]")}
          style={{
            height: active ? `${Math.random() * 28 + 8}px` : "8px",
            animation: active ? `speakBounce ${0.4 + i * 0.07}s infinite alternate` : "none",
          }}
        />
      ))}
      <style>{`@keyframes speakBounce { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }`}</style>
    </div>
  );
}

// ─── Criteria bar ─────────────────────────────────────────────────────────────

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

type Phase = "landing" | "intro" | "prep" | "recording" | "recorded" | "loading" | "feedback";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SpeakingTestPage() {
  const router = useRouter();
  const [topics, setTopics] = useState(FALLBACK_TOPICS as any[]);
  const [partIdx, setPartIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("landing");
  const [prepTime, setPrepTime] = useState(60);
  const [recordTime, setRecordTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [showSample, setShowSample] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const lastAudioBlobRef = useRef<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const part = topics[partIdx];
  const maxPart = topics.length;
  const isLastPart = partIdx === maxPart - 1;
  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Load topics from Supabase ──
  useEffect(() => {
    async function load() {
      try {
        const sb = createClient();
        const p1 = await getSpeakingTopics(sb, 1, 1);
        const p2 = await getSpeakingTopics(sb, 2, 1);
        const p3 = await getSpeakingTopics(sb, 3, 1);
        if (p1.length && p2.length && p3.length) {
          setTopics([
            { ...(p1[0] as object), questions: ((p1[0] as any).follow_up_questions as string[]) ?? FALLBACK_TOPICS[0].questions },
            { ...(p2[0] as object), cue_card_points: ((p2[0] as any).cue_card_points as string[]) ?? FALLBACK_TOPICS[1].cue_card_points },
            { ...(p3[0] as object), questions: ((p3[0] as any).follow_up_questions as string[]) ?? FALLBACK_TOPICS[2].questions },
          ]);
        }
      } catch { /* use fallback */ }
    }
    load();
  }, []);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Timer ──
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (phase === "prep") {
      timerRef.current = setInterval(() => {
        setPrepTime((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setPhase("recording");
            startRecording();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    if (phase === "recording") {
      timerRef.current = setInterval(() => setRecordTime((t) => t + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // ── MediaRecorder helpers ──
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      // Pick the first supported mime type
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        lastAudioBlobRef.current = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start(250);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordTime(0);
    } catch {
      setMicDenied(true);
      setIsRecording(true);
      setRecordTime(0);
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setPhase("recorded");
  }

  // ── Navigate between questions/parts ──
  function handleNext() {
    const questions = part.questions as string[] | undefined;
    const hasMoreQ = questions && questionIdx < questions.length - 1;

    if (hasMoreQ) {
      setQuestionIdx((i) => i + 1);
      setPhase("intro");
    } else if (!isLastPart) {
      setPartIdx((i) => i + 1);
      setQuestionIdx(0);
      setPhase("intro");
    } else {
      submitForFeedback();
    }
  }

  // ── Submit to API ──
  async function submitForFeedback() {
    setPhase("loading");
    setError(null);

    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();

      const formData = new FormData();

      // Use the Part 2 topic for assessment (most assessable)
      const p2topic = topics[1];
      const topicText = p2topic?.topic_text ?? "Describe a topic from your daily life";

      if (lastAudioBlobRef.current) {
        formData.append("audio", lastAudioBlobRef.current, "speaking.webm");
      } else {
        // No real audio - create empty blob to satisfy API
        formData.append("audio", new Blob([""], { type: "audio/webm" }), "speaking.webm");
      }
      formData.append("topic", topicText);
      formData.append("part", "2");
      if (user && p2topic?.id) formData.append("contentId", p2topic.id);

      const res = await fetch("/api/ai/speaking", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429 || res.status === 400) {
          setError(data.message ?? "Ошибка. Попробуйте снова.");
          setPhase("recorded");
          return;
        }
        throw new Error(data.error ?? "API error");
      }

      const data: SpeakingFeedback = await res.json();
      setFeedback(data);
      setPhase("feedback");
    } catch (err) {
      setError("Не удалось получить фидбек. Попробуйте снова.");
      setPhase("recorded");
    }
  }

  // ── Feedback phase ──
  if (phase === "feedback" && feedback) {
    const overall = feedback.overall_band;
    const overallColor = overall >= 7 ? "text-[rgb(var(--band-high))]" : overall >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]";
    const overallBorder = overall >= 7 ? "border-[rgb(var(--band-high))]" : overall >= 5.5 ? "border-[rgb(var(--band-mid))]" : "border-[rgb(var(--band-low))]";

    const criteriaList = [
      { code: "FC", name: "Fluency & Coherence", band: feedback.fluency_coherence },
      { code: "LR", name: "Lexical Resource", band: feedback.lexical_resource },
      { code: "GRA", name: "Grammatical Range", band: feedback.grammatical_range },
      { code: "PR", name: "Pronunciation", band: feedback.pronunciation },
    ];

    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col">
        <header className="sticky top-0 z-40 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
              <ChevronLeft className="w-4 h-4" />Dashboard
            </Link>
            <div className="flex items-center gap-2 ml-2">
              <Sparkles className="w-4 h-4 text-[rgb(var(--primary))]" />
              <span className="font-medium text-sm">AI Speaking Feedback</span>
            </div>
          </div>
        </header>

        <div className="max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
          {/* Score */}
          <div className="flex flex-col sm:flex-row items-center gap-6 bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
            <div className={cn("w-24 h-24 rounded-full border-4 flex items-center justify-center shrink-0", overallBorder)}>
              <span className={cn("font-mono text-3xl font-bold", overallColor)}>{overall.toFixed(1)}</span>
            </div>
            <div className="flex-1 w-full">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-[rgb(var(--foreground))]">Speaking Test</span>
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
                <span className="font-semibold text-sm">Сильные стороны</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {feedback.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[rgb(var(--foreground))]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--success))] mt-2 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          <div className="bg-[rgb(var(--primary)/0.06)] border border-[rgb(var(--primary)/0.15)] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[rgb(var(--primary))]" />
              <span className="font-semibold text-sm">Что улучшить</span>
            </div>
            <ol className="flex flex-col gap-4">
              {feedback.improvements.map((imp, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[rgb(var(--primary)/0.15)] text-[rgb(var(--primary))] text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-[rgb(var(--foreground))] mb-0.5">{imp.issue}</p>
                    {imp.example && <p className="text-[rgb(var(--muted-foreground))] italic text-xs mb-1">«{imp.example}»</p>}
                    <p className="text-[rgb(var(--foreground))]">{imp.suggestion}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Model phrases */}
          {feedback.model_phrases?.length > 0 && (
            <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl p-5">
              <div className="font-semibold text-sm mb-3">Полезные фразы</div>
              <div className="flex flex-wrap gap-2">
                {feedback.model_phrases.map((p, i) => (
                  <span key={i} className="text-xs bg-[rgb(var(--primary)/0.08)] text-[rgb(var(--primary))] rounded-full px-3 py-1 font-medium">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Transcript */}
          {feedback.transcript && !feedback.transcript.includes("[Audio transcription unavailable") && (
            <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl p-5">
              <div className="font-semibold text-sm mb-2">Транскрипция</div>
              <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed">{feedback.transcript}</p>
            </div>
          )}

          {/* Sample answer */}
          {topics[1]?.sample_answer && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
              <button
                onClick={() => setShowSample((v) => !v)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span className="font-semibold text-sm text-[rgb(var(--foreground))]">Образец ответа Band 8+</span>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-[rgb(var(--muted-foreground))] transition-transform", showSample && "rotate-180")} />
              </button>
              {showSample && (
                <div className="mt-4 pt-4 border-t border-amber-200">
                  <p className="text-sm text-[rgb(var(--foreground))] leading-relaxed whitespace-pre-wrap">{topics[1].sample_answer}</p>
                  <p className="text-xs text-amber-700 mt-3 italic">
                    💡 Обрати внимание на структуру (intro → middle → conclusion), линкеры (however, in addition, on the other hand) и idioms.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" asChild><Link href="/dashboard">Dashboard</Link></Button>
            <Button className="flex-1" onClick={() => { setFeedback(null); setPhase("intro"); setPartIdx(0); setQuestionIdx(0); }}>
              Ещё практика
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[rgb(var(--primary)/0.1)] flex items-center justify-center mx-auto mb-5">
            <Loader2 className="w-8 h-8 text-[rgb(var(--primary))] animate-spin" />
          </div>
          <p className="text-[rgb(var(--foreground))] font-medium">Анализируем ваши ответы...</p>
          <p className="text-xs text-[rgb(var(--muted-foreground))] mt-2">Whisper + Claude · ~15 секунд</p>
        </div>
      </div>
    );
  }

  // ── Test UI ──
  const currentQuestions = part?.questions as string[] | undefined;
  const cuePoints = part?.cue_card_points as string[] | undefined;

  // ── LANDING phase (pre-test) ──
  if (phase === "landing") {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))]">
        <header className="sticky top-0 z-40 bg-white border-b border-[rgb(var(--border))]">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
              <ChevronLeft className="w-4 h-4" />Dashboard
            </Link>
            <div className="flex items-center gap-2 ml-2">
              <Mic2 className="w-4 h-4 text-violet-500" />
              <span className="font-semibold text-[rgb(var(--foreground))]">Speaking Test</span>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl border border-[rgb(var(--border))] shadow-sm p-8 flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
              <Mic2 className="w-8 h-8 text-violet-500" />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-[rgb(var(--foreground))] mb-2">IELTS Speaking</h1>
              <p className="text-sm text-[rgb(var(--muted-foreground))]">3 части: интервью, монолог и дискуссия</p>
            </div>

            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-violet-500">~12 мин</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">Время</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-violet-500">3</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">Частей</div>
              </div>
            </div>

            <div className="text-left w-full">
              <h2 className="font-semibold text-[rgb(var(--foreground))] mb-3">Формат теста</h2>
              <ul className="space-y-2 text-sm text-[rgb(var(--muted-foreground))]">
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>Part 1: Введение и интервью (5 минут)</li>
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>Part 2: Развёрнутый ответ по карточке (1 мин подготовка + 2 мин)</li>
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>Part 3: Двусторонняя дискуссия (5 минут)</li>
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>Оценка: Fluency, Vocabulary, Grammar, Pronunciation</li>
              </ul>
            </div>

            <div className="w-full bg-[rgb(var(--muted)/0.05)] rounded-lg px-4 py-2.5 text-xs text-[rgb(var(--muted-foreground))] text-center">
              🌐 Тест проводится полностью на английском языке
            </div>

            <button
              onClick={() => { setPartIdx(0); setQuestionIdx(0); setPhase("intro"); }}
              className="w-full bg-[rgb(var(--primary))] hover:bg-[rgb(var(--primary)/0.92)] text-white font-semibold py-3.5 px-5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md shadow-[rgb(var(--primary)/0.25)]"
            >
              Начать тест Speaking
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="relative w-full flex items-center gap-3">
              <div className="flex-1 h-px bg-[rgb(var(--border))]" />
              <span className="text-[10px] uppercase tracking-widest text-[rgb(var(--muted-foreground))]">Или практикуйте по частям</span>
              <div className="flex-1 h-px bg-[rgb(var(--border))]" />
            </div>
            <div className="grid grid-cols-3 gap-2 w-full">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  onClick={() => { setPartIdx(i); setQuestionIdx(0); setPhase("intro"); }}
                  className="rounded-xl border border-[rgb(var(--border))] hover:border-[rgb(var(--primary)/0.4)] hover:bg-[rgb(var(--primary)/0.03)] py-2.5 px-3 text-sm font-medium text-[rgb(var(--foreground))] transition-all"
                >
                  Part {i + 1}
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col">
      <header className="sticky top-0 z-40 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] shrink-0">
            <ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Dashboard</span>
          </Link>
          <div className="flex-1 flex items-center gap-2">
            <Mic2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
            <span className="text-sm font-medium text-[rgb(var(--foreground))] truncate">
              Part {part?.part} — Speaking
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn("w-2 h-2 rounded-full transition-all",
                i < partIdx ? "bg-[rgb(var(--success))]" : i === partIdx ? "bg-[rgb(var(--primary))] w-3" : "bg-[rgb(var(--border))]"
              )} />
            ))}
          </div>
        </div>
      </header>

      {micDenied && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Микрофон недоступен — запись не ведётся, но практика продолжается.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 text-center">{error}</div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg flex flex-col gap-6">
          <div className="text-center">
            <Badge variant="default" className="mb-2">Part {part?.part} · {partIdx + 1}/{maxPart}</Badge>
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              {part?.part === 1 ? "Вопросы о себе ~4 минуты" : part?.part === 2 ? "1 минута подготовки → 1–2 минуты ответа" : "Дискуссия ~4 минуты"}
            </p>
          </div>

          {/* Content card */}
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
            {/* Part 1 & 3 */}
            {(part?.part === 1 || part?.part === 3) && currentQuestions && (
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--primary))] text-xs font-bold flex items-center justify-center">
                    {questionIdx + 1}
                  </span>
                  <span className="text-xs text-[rgb(var(--muted-foreground))]">из {currentQuestions.length} вопросов</span>
                  <button
                    onClick={() => {
                      const q = currentQuestions[questionIdx];
                      const params = new URLSearchParams({
                        q: `Помоги подготовиться к Speaking Part ${part.part}, вопрос: "${q}". Подскажи структуру ответа, ключевую лексику, и пример сильного ответа.`,
                      });
                      router.push(`/tutor?${params.toString()}`);
                    }}
                    className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-50 border border-violet-200 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
                  >
                    <MessageCircle className="w-3 h-3" />
                    Спросить ИИ
                  </button>
                </div>
                <p className="text-lg font-semibold text-[rgb(var(--foreground))] leading-snug">
                  {currentQuestions[questionIdx]}
                </p>
              </div>
            )}

            {/* Part 2 — cue card */}
            {part?.part === 2 && (
              <div>
                <div className="bg-[rgb(var(--primary)/0.05)] border-b border-[rgb(var(--border))] px-6 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4 text-[rgb(var(--primary))]" />
                    <span className="text-xs font-semibold text-[rgb(var(--primary))] uppercase tracking-wide">Cue Card</span>
                    <button
                      onClick={() => {
                        const params = new URLSearchParams({
                          q: `Помоги с Speaking Part 2 cue card: "${part.topic_text}". Подскажи структуру 2-минутного монолога, ключевую лексику и пример идеи для каждого пункта.`,
                        });
                        router.push(`/tutor?${params.toString()}`);
                      }}
                      className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-50 border border-violet-200 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
                    >
                      <MessageCircle className="w-3 h-3" />
                      Спросить ИИ
                    </button>
                  </div>
                  <p className="font-semibold text-[rgb(var(--foreground))] leading-snug">{part.topic_text}</p>
                </div>
                {cuePoints && (
                  <div className="p-6">
                    <p className="text-xs text-[rgb(var(--muted-foreground))] mb-3 font-medium">Включите в ответ:</p>
                    <ul className="flex flex-col gap-2">
                      {cuePoints.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[rgb(var(--foreground))]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--primary))] mt-2 shrink-0" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recording controls */}
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 flex flex-col items-center gap-4">
            {part?.part === 2 && phase === "prep" && (
              <div className="text-center">
                <p className="text-xs text-[rgb(var(--muted-foreground))] mb-1">Время на подготовку</p>
                <span className="font-mono text-4xl font-bold text-[rgb(var(--warning))]">{mmss(prepTime)}</span>
              </div>
            )}

            {phase === "recording" && (
              <div className="w-full">
                <WaveformBars active={isRecording} />
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <div className="w-2 h-2 rounded-full bg-[rgb(var(--destructive))] animate-pulse" />
                  <span className="font-mono text-sm text-[rgb(var(--foreground))]">{mmss(recordTime)}</span>
                </div>
              </div>
            )}

            {phase === "recorded" && (
              <div className="flex items-center gap-2 text-[rgb(var(--success))]">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">Записано ({mmss(recordTime)})</span>
              </div>
            )}

            {phase === "intro" && (
              <div className="flex items-center gap-2 text-[rgb(var(--muted-foreground))]">
                <Mic2 className="w-5 h-5" />
                <span className="text-sm">Нажми «Начать» чтобы ответить</span>
              </div>
            )}

            <div className="flex gap-3 w-full">
              {phase === "intro" && (
                <Button size="lg" className="flex-1 gap-2" onClick={() => {
                  if (part?.part === 2) { setPhase("prep"); setPrepTime(60); }
                  else { setPhase("recording"); startRecording(); }
                }}>
                  <Mic2 className="w-4 h-4" />
                  Начать запись
                </Button>
              )}

              {phase === "prep" && (
                <Button size="lg" className="flex-1 gap-2 bg-[rgb(var(--warning))] hover:bg-[rgb(var(--warning)/0.88)]"
                  onClick={() => { setPhase("recording"); startRecording(); }}>
                  <Mic2 className="w-4 h-4" />
                  Начать сейчас
                </Button>
              )}

              {phase === "recording" && (
                <Button size="lg" variant="destructive" className="flex-1 gap-2" onClick={stopRecording}>
                  <Square className="w-4 h-4" />
                  Стоп
                </Button>
              )}

              {phase === "recorded" && (
                <>
                  <Button size="lg" variant="outline" className="gap-2"
                    onClick={() => { setPhase("intro"); setRecordTime(0); lastAudioBlobRef.current = null; }}>
                    <RotateCcw className="w-4 h-4" />
                    Перезаписать
                  </Button>
                  <Button size="lg" className="flex-1 gap-2" onClick={handleNext}>
                    {isLastPart ? "Завершить тест" : "Следующий"}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
