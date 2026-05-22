"use client";

import { Suspense, useState, useRef, useEffect } from "react";
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
  Volume2,
  VolumeX,
  Share2,
  Gauge,
  Timer,
  Play,
  Eye,
  Info,
  ArrowRight,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSpeakingTopics } from "@/lib/supabase/queries";
import { parseSpeakingTopic } from "@/lib/test-mapping/content-filter";
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
  criteria_comments?: {
    fluency_coherence?: string;
    lexical_resource?: string;
    grammatical_range?: string;
    pronunciation?: string;
  };
  improvements: Array<{ issue: string; example: string; suggestion: string; category?: string; correction?: string; from_band?: number; to_band?: number; severity?: "minor" | "major" }>;
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

// Stable pseudo-random bar heights (12 bars). React rule: don't call Math.random
// during render — heights would change every paint and break the animation.
const WAVEFORM_HEIGHTS = [22, 14, 30, 18, 10, 26, 12, 24, 16, 28, 20, 12];

function WaveformBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1 h-10">
      {WAVEFORM_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className={cn("w-1 rounded-full transition-all", active ? "bg-[rgb(var(--primary))]" : "bg-[rgb(var(--border))]")}
          style={{
            height: active ? `${h}px` : "8px",
            animation: active ? `speakBounce ${0.4 + i * 0.07}s infinite alternate` : "none",
          }}
        />
      ))}
      <style>{`@keyframes speakBounce { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }`}</style>
    </div>
  );
}

// ─── TTS speak button ────────────────────────────────────────────────────────

function SpeakButton({ text, className }: { text: string; className?: string }) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    function onEnd() { setSpeaking(false); }
    window.speechSynthesis?.addEventListener?.("end", onEnd);
    return () => {
      window.speechSynthesis?.removeEventListener?.("end", onEnd);
      window.speechSynthesis?.cancel();
    };
  }, []);

  function handleSpeak() {
    const synth = window.speechSynthesis;
    if (!synth) return;

    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 0.92;
    utterance.pitch = 1;

    // Prefer a British English voice if available
    const voices = synth.getVoices();
    const enGB = voices.find((v) => v.lang === "en-GB" && v.name.includes("Google"));
    const enAny = voices.find((v) => v.lang.startsWith("en"));
    if (enGB) utterance.voice = enGB;
    else if (enAny) utterance.voice = enAny;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  }

  if (typeof window !== "undefined" && !window.speechSynthesis) return null;

  return (
    <button
      onClick={handleSpeak}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
        speaking
          ? "bg-violet-100 border border-violet-300 text-violet-700"
          : "bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100",
        className,
      )}
      title={speaking ? "Остановить" : "Озвучить вопрос"}
    >
      {speaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
      {speaking ? "Стоп" : "Озвучить"}
    </button>
  );
}

type Phase = "landing" | "intro" | "prep" | "recording" | "recorded" | "loading" | "feedback";

// ─── Page ─────────────────────────────────────────────────────────────────────

// A unified topic shape that covers all 3 parts. `questions` is used for
// Parts 1 & 3 (follow-up questions); `cue_card_points` is used for Part 2.
type Topic = {
  id: string;
  part?: 1 | 2 | 3;
  topic_text?: string;
  questions?: string[];
  cue_card_points?: string[];
  sample_answer?: string | null;
};

function SpeakingTestPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTopicId = searchParams.get("id");
  const selectedPart = Number(searchParams.get("part"));
  const [topics, setTopics] = useState<Topic[]>(FALLBACK_TOPICS as Topic[]);
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
  // "full" = all 3 parts, "single" = only the selected part
  const [mode, setMode] = useState<"full" | "single">("full");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const lastAudioBlobRef = useRef<Blob | null>(null);
  // Per-part audio recordings. Indexed by partIdx (0 = Part 1, 1 = Part 2, 2 = Part 3).
  // The previous bug sent only Part 2 for evaluation; Parts 1 and 3 were
  // recorded but discarded. We now collect everything and submit all three.
  const recordingsRef = useRef<Record<number, Blob>>({});
  const currentPartIdxRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  // Part 2 has a hard 2-minute cap in real IELTS — examiner stops the candidate.
  const PART2_MAX_SECONDS = 120;

  const part = topics[partIdx];
  const maxPart = topics.length;
  // In single mode, the current part is always the last (and only) part
  const isLastPart = mode === "single" ? true : partIdx === maxPart - 1;
  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Load topics from Supabase ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const sb = createClient();
        if (selectedTopicId && [1, 2, 3].includes(selectedPart)) {
          const { data: selectedRaw } = await sb
            .from("speaking_topics")
            .select("*")
            .eq("id", selectedTopicId)
            .single();
          const selected = selectedRaw as unknown as SpeakingTopic | null;
          if (cancelled) return;
          if (selected) {
            const parsed = parseSpeakingTopic(selected.topic_text);
            const fallback = FALLBACK_TOPICS[(selectedPart || 1) - 1];
            const followUps = Array.isArray(selected.follow_up_questions) ? selected.follow_up_questions.map(String) : fallback.questions;
            const cuePoints = Array.isArray(selected.cue_card_points) ? selected.cue_card_points.map(String) : parsed.bullets ?? fallback.cue_card_points;
            const selectedTopic: Topic = {
              id: selected.id,
              part: selected.part,
              topic_text: parsed.text.trim().length > 5 ? parsed.text : fallback.topic_text,
              questions: followUps,
              cue_card_points: cuePoints,
              sample_answer: selected.sample_answer,
            };
            setTopics([selectedTopic]);
            setPartIdx(0);
            setMode("single");
            return;
          }
        }
        // Fetch all 3 parts in parallel (previously sequential — 3× latency).
        const [p1, p2, p3] = await Promise.all([
          getSpeakingTopics(sb, 1, 1),
          getSpeakingTopics(sb, 2, 1),
          getSpeakingTopics(sb, 3, 1),
        ]);
        if (cancelled) return;
        if (p1.length && p2.length && p3.length) {
          // DB rows store cue-card points & follow-up questions as JSON arrays
          // on the row; map them into our Topic shape.
          type DbTopic = {
            id: string;
            part: 1 | 2 | 3;
            topic_text: string;
            cue_card_points?: string[] | null;
            follow_up_questions?: string[] | null;
          };
          const r1 = p1[0] as DbTopic;
          const r2 = p2[0] as DbTopic;
          const r3 = p3[0] as DbTopic;

          // topic_text from the legacy import sometimes contains a stringified
          // JSON array — produces literal "[" in the UI. parseSpeakingTopic
          // returns plain text + (for Part 2) bullets to use as cue card points
          // when the dedicated cue_card_points field is null (importer bug #7).
          const t1 = parseSpeakingTopic(r1.topic_text);
          const t2 = parseSpeakingTopic(r2.topic_text);
          const t3 = parseSpeakingTopic(r3.topic_text);

          // Fall back to a clean default if topic_text is unusable.
          const topicOr = (parsed: { text: string }, fallback: string) =>
            parsed.text.trim().length > 5 ? parsed.text : fallback;

          setTopics([
            {
              id: r1.id, part: 1,
              topic_text: topicOr(t1, FALLBACK_TOPICS[0].topic_text),
              questions: r1.follow_up_questions ?? FALLBACK_TOPICS[0].questions,
            },
            {
              id: r2.id, part: 2,
              topic_text: topicOr(t2, FALLBACK_TOPICS[1].topic_text),
              // If the importer didn't populate cue_card_points but the topic
              // itself was a JSON array of points, use those instead.
              cue_card_points:
                r2.cue_card_points
                ?? t2.bullets
                ?? FALLBACK_TOPICS[1].cue_card_points,
            },
            {
              id: r3.id, part: 3,
              topic_text: topicOr(t3, FALLBACK_TOPICS[2].topic_text),
              questions: r3.follow_up_questions ?? FALLBACK_TOPICS[2].questions,
            },
          ]);
        }
      } catch { /* use fallback */ }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedPart, selectedTopicId]);

  // Keep currentPartIdxRef in sync so MediaRecorder.onstop knows which part the recording belongs to.
  useEffect(() => { currentPartIdxRef.current = partIdx; }, [partIdx]);

  // Auto-speak question when entering intro phase (simulates examiner)
  useEffect(() => {
    if (phase !== "intro") return;
    const synth = window.speechSynthesis;
    if (!synth) return;

    let textToSpeak = "";
    if ((part?.part === 1 || part?.part === 3) && currentQuestions?.[questionIdx]) {
      textToSpeak = currentQuestions[questionIdx];
    } else if (part?.part === 2 && part.topic_text) {
      const points = (part.cue_card_points as string[] | undefined);
      textToSpeak = `${part.topic_text}. You should say: ${points?.join(". ") ?? ""}`;
    }
    if (!textToSpeak) return;

    // Small delay so the UI renders first
    const timeout = setTimeout(() => {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = "en-GB";
      utterance.rate = 0.92;
      const voices = synth.getVoices();
      const enGB = voices.find((v) => v.lang === "en-GB" && v.name.includes("Google"));
      const enAny = voices.find((v) => v.lang.startsWith("en"));
      if (enGB) utterance.voice = enGB;
      else if (enAny) utterance.voice = enAny;
      synth.speak(utterance);
    }, 400);

    return () => { clearTimeout(timeout); synth.cancel(); };
  }, [phase, partIdx, questionIdx]);

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
      timerRef.current = setInterval(() => {
        setRecordTime((t) => {
          const next = t + 1;
          // Part 2 hard cap: 2 minutes — auto-stops recording like the real exam.
          if (partIdx === 1 && next >= PART2_MAX_SECONDS) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
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
        const blob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
        lastAudioBlobRef.current = blob;
        // Save under the part we just recorded, so all 3 parts contribute to evaluation.
        recordingsRef.current[currentPartIdxRef.current] = blob;
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start(250);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordTime(0);
    } catch {
      setMicDenied(true);
      setError("Микрофон недоступен. Разрешите доступ к микрофону в настройках браузера.");
      setPhase("intro");
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
  // Combines all recorded parts into one audio blob and one combined topic
  // prompt so the AI evaluates the FULL session, not just Part 2.
  async function submitForFeedback() {
    setPhase("loading");
    setError(null);

    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();

      // Combine Parts 1 + 2 + 3 in order. Concatenating WebM byte streams is
      // not strictly conformant, but Whisper accepts it in practice as long
      // as the first part's header is valid. If any part is missing we just
      // skip it.
      const orderedParts = [0, 1, 2]
        .map((i) => recordingsRef.current[i])
        .filter((b): b is Blob => b instanceof Blob && b.size > 0);

      // If absolutely nothing was recorded, fall back to lastAudioBlobRef
      // (Part 2 only) so we still send something rather than failing silently.
      const combinedAudio: Blob = orderedParts.length > 0
        ? new Blob(orderedParts, { type: orderedParts[0].type || "audio/webm" })
        : (lastAudioBlobRef.current ?? new Blob([""], { type: "audio/webm" }));

      // Build a combined topic prompt covering all 3 parts so the examiner
      // model knows what the candidate was answering.
      const topicText = [
        topics[0]?.topic_text && `Part 1 — ${topics[0].topic_text}`,
        topics[1]?.topic_text && `Part 2 (cue card, 1–2 min long turn) — ${topics[1].topic_text}`,
        topics[2]?.topic_text && `Part 3 (discussion) — ${topics[2].topic_text}`,
      ].filter(Boolean).join("\n\n");

      const formData = new FormData();
      formData.append("audio", combinedAudio, "speaking-full.webm");
      formData.append("topic", topicText || "IELTS Speaking — full session (Parts 1–3)");
      // "part" = "all" tells the API this is a combined session, not a single part.
      formData.append("part", "all");
      // Use Part 2's content_id (cue-card topic) as the canonical content for the attempt row.
      const canonicalContentId = topics[1]?.id ?? topics[0]?.id ?? topics[2]?.id;
      if (user && canonicalContentId) formData.append("contentId", String(canonicalContentId));

      const res = await fetch("/api/ai/speaking", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403 || res.status === 429 || res.status === 400) {
          setError(data.message ?? "Ошибка. Попробуйте снова.");
          setPhase("recorded");
          return;
        }
        throw new Error(data.error ?? "API error");
      }

      const data: SpeakingFeedback = await res.json();
      setFeedback(data);
      setPhase("feedback");
    } catch {
      setError("Не удалось получить фидбек. Попробуйте снова.");
      setPhase("recorded");
    }
  }

  // ── Feedback phase ──
  if (phase === "feedback" && feedback) {
    return (
      <SpeakingReportV2
        feedback={feedback}
        topics={topics}
        showSample={showSample}
        setShowSample={setShowSample}
        onRetry={() => { setFeedback(null); setPhase("landing"); setPartIdx(0); setQuestionIdx(0); setMode("full"); recordingsRef.current = {}; }}
      />
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
              onClick={() => { setMode("full"); setPartIdx(0); setQuestionIdx(0); recordingsRef.current = {}; setPhase("intro"); }}
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
                  onClick={() => { setMode("single"); setPartIdx(i); setQuestionIdx(0); recordingsRef.current = {}; setPhase("intro"); }}
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
                  <div className="ml-auto flex items-center gap-1.5">
                    <SpeakButton text={currentQuestions[questionIdx]} />
                    <button
                      onClick={() => {
                        const q = currentQuestions[questionIdx];
                        const params = new URLSearchParams({
                          q: `Помоги подготовиться к Speaking Part ${part.part}, вопрос: "${q}". Подскажи структуру ответа, ключевую лексику, и пример сильного ответа.`,
                        });
                        router.push(`/tutor?${params.toString()}`);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-50 border border-violet-200 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
                    >
                      <MessageCircle className="w-3 h-3" />
                      Спросить ИИ
                    </button>
                  </div>
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
                    <div className="ml-auto flex items-center gap-1.5">
                      <SpeakButton text={`${part.topic_text ?? ""}. You should say: ${cuePoints?.join(". ") ?? ""}`} />
                      <button
                        onClick={() => {
                          const params = new URLSearchParams({
                            q: `Помоги с Speaking Part 2 cue card: "${part.topic_text}". Подскажи структуру 2-минутного монолога, ключевую лексику и пример идеи для каждого пункта.`,
                          });
                          router.push(`/tutor?${params.toString()}`);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-50 border border-violet-200 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
                      >
                        <MessageCircle className="w-3 h-3" />
                        Спросить ИИ
                      </button>
                    </div>
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

export default function SpeakingTestPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[rgb(var(--background))] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[rgb(var(--primary))]" />
        </div>
      }
    >
      <SpeakingTestPageContent />
    </Suspense>
  );
}

// ─── CEFR mapping ────────────────────────────────────────────────────────────

function bandToCEFR(band: number): string {
  if (band >= 8.5) return "C2";
  if (band >= 7) return "C1";
  if (band >= 5.5) return "B2";
  if (band >= 4) return "B1";
  if (band >= 2.5) return "A2";
  return "A1";
}

function bandDescriptor(band: number): string {
  if (band >= 8.5) return "Expert User";
  if (band >= 7.5) return "Very Good User";
  if (band >= 6.5) return "Good User";
  if (band >= 5.5) return "Competent User";
  if (band >= 4.5) return "Modest User";
  if (band >= 3.5) return "Limited User";
  if (band >= 2.5) return "Extremely Limited";
  return "Intermittent User";
}

const CRITERIA_COLORS: Record<string, string> = {
  FC: "#1473E6",
  LR: "#F59E0B",
  GRA: "#10B981",
  PR: "#A855F7",
};

const CRITERIA_DESCRIPTIONS: Record<string, Record<string, string>> = {
  FC: {
    high: "Вы говорите свободно с минимальными паузами. Ваша речь связная и логичная.",
    mid: "Вы говорите с некоторыми паузами и повторами. Связность ответов можно улучшить.",
    low: "Частые паузы и затруднения в речи. Сложно поддерживать связный ответ.",
  },
  LR: {
    high: "Богатый словарный запас, используете идиомы и коллокации естественно.",
    mid: "Хороший словарный запас для общих тем, но ограничен для сложных.",
    low: "Ограниченный словарный запас, частые повторы одних и тех же слов.",
  },
  GRA: {
    high: "Используете сложные грамматические конструкции точно и уверенно.",
    mid: "Хорошо используете базовые конструкции, но делаете ошибки в сложных.",
    low: "Много грамматических ошибок даже в простых предложениях.",
  },
  PR: {
    high: "Произношение чёткое, правильное ударение и интонация.",
    mid: "Произношение понятное, но есть ошибки в ударении и некоторых звуках.",
    low: "Произношение затрудняет понимание. Нужно работать над звуками и ударением.",
  },
};

function criteriaFilter(code: string, issue: string): boolean {
  const lower = issue.toLowerCase();
  if (code === "FC") return lower.includes("fluency") || lower.includes("связн") || lower.includes("пауз") || lower.includes("coherence") || lower.includes("плавн");
  if (code === "LR") return lower.includes("лексик") || lower.includes("словар") || lower.includes("vocab") || lower.includes("lexic") || lower.includes("слов");
  if (code === "GRA") return lower.includes("грамм") || lower.includes("grammar") || lower.includes("времен") || lower.includes("ошибк");
  if (code === "PR") return lower.includes("произнош") || lower.includes("pronunc") || lower.includes("ударен") || lower.includes("интон");
  return false;
}

function categoryFilter(code: string, item: SpeakingFeedback["improvements"][number]): boolean {
  const category = item.category?.toLowerCase();
  if (category) {
    if (code === "FC") return category.includes("fluency") || category.includes("coherence");
    if (code === "LR") return category.includes("lexical") || category.includes("vocab");
    if (code === "GRA") return category.includes("grammar") || category.includes("grammatical");
    if (code === "PR") return category.includes("pronunciation");
  }
  return criteriaFilter(code, `${item.issue} ${item.suggestion}`);
}

function cleanSpeakingText(text: string | null | undefined) {
  return (text ?? "").replace(/[“”"]/g, "").trim();
}

function splitTranscriptForParts(transcript: string, partCount: number) {
  const clean = transcript.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [clean];
  const safeCount = Math.max(1, partCount);
  const perPart = Math.max(1, Math.ceil(sentences.length / safeCount));
  return Array.from({ length: safeCount }, (_, idx) => sentences.slice(idx * perPart, (idx + 1) * perPart).join(" ").trim()).filter(Boolean);
}

function speakingSpeed(wordCount: number, partCount: number) {
  const estimatedSeconds = Math.max(15, partCount === 1 ? 75 : 240);
  return Math.round((wordCount / estimatedSeconds) * 60);
}

function scoreArcStyle(band: number) {
  const degrees = Math.max(0, Math.min(360, (band / 9) * 360));
  return {
    background: `conic-gradient(#1473E6 ${degrees}deg, rgb(var(--surface-elevated)) ${degrees}deg 360deg)`,
  };
}

// ─── Speaking Report ─────────────────────────────────────────────────────────

function SpeakingReportV2({
  feedback,
  topics,
  showSample,
  setShowSample,
  onRetry,
}: {
  feedback: SpeakingFeedback;
  topics: Topic[];
  showSample: boolean;
  setShowSample: (v: boolean) => void;
  onRetry: () => void;
}) {
  const [activePart, setActivePart] = useState(0);
  const [answerView, setAnswerView] = useState<"original" | "feedback">("feedback");
  const [analysisTab, setAnalysisTab] = useState<"fluency" | "vocabulary" | "grammar" | "pronunciation">("fluency");

  const overall = feedback.overall_band;
  const cefr = bandToCEFR(overall);
  const wordCount = feedback.transcript?.split(/\s+/).filter(Boolean).length ?? 0;
  const visibleTopics = topics.length > 0 ? topics : (FALLBACK_TOPICS as Topic[]);
  const transcriptParts = splitTranscriptForParts(feedback.transcript, visibleTopics.length);
  const activeTopic = visibleTopics[Math.min(activePart, visibleTopics.length - 1)];
  const activeTranscript = transcriptParts[Math.min(activePart, transcriptParts.length - 1)] || feedback.transcript;
  const wpm = speakingSpeed(wordCount, visibleTopics.length);
  const hesitationCount = Math.max(0, (feedback.transcript.match(/\b(um|uh|er|like|you know)\b/gi) ?? []).length);
  const fillerCount = Math.max(0, (feedback.transcript.match(/\b(so|actually|basically|well)\b/gi) ?? []).length);

  const criteriaCards = [
    {
      code: "FC",
      short: "Fluency",
      name: "Fluency & Coherence",
      band: feedback.fluency_coherence,
      comment: feedback.criteria_comments?.fluency_coherence,
    },
    {
      code: "LR",
      short: "Lexical",
      name: "Lexical Resource",
      band: feedback.lexical_resource,
      comment: feedback.criteria_comments?.lexical_resource,
    },
    {
      code: "GRA",
      short: "Grammar",
      name: "Grammatical Range",
      band: feedback.grammatical_range,
      comment: feedback.criteria_comments?.grammatical_range,
    },
    {
      code: "PR",
      short: "Pronun.",
      name: "Pronunciation",
      band: feedback.pronunciation,
      comment: feedback.criteria_comments?.pronunciation,
    },
  ];

  const grammarFixes = feedback.improvements.filter((imp) => categoryFilter("GRA", imp));
  const vocabFixes = feedback.improvements.filter((imp) => categoryFilter("LR", imp));
  const pronunciationFixes = feedback.improvements.filter((imp) => categoryFilter("PR", imp));
  const recommendations = feedback.improvements.length > 0
    ? feedback.improvements.map((imp) => imp.suggestion)
    : [
      "Увеличивайте длину ответов: добавляйте причину, пример и короткий вывод.",
      "Старайтесь заменять простые слова более точными IELTS-фразами.",
      "Практикуйте ответы вслух с таймером, чтобы уменьшить паузы.",
    ];

  const detailTabs = [
    { id: "fluency", label: "Fluency", code: "FC" },
    { id: "vocabulary", label: "Vocabulary", code: "LR" },
    { id: "grammar", label: "Grammar", code: "GRA" },
    { id: "pronunciation", label: "Pronunciation", code: "PR" },
  ] as const;
  const activeCriterion = criteriaCards.find((c) => c.code === detailTabs.find((t) => t.id === analysisTab)?.code) ?? criteriaCards[0];
  const activeImprovements = feedback.improvements.filter((imp) => categoryFilter(activeCriterion.code, imp));

  async function shareReport() {
    const text = `IELTS Speaking: ${overall.toFixed(1)} (${cefr})`;
    try {
      if (navigator.share) await navigator.share({ title: "IELTS Speaking Report", text });
      else await navigator.clipboard.writeText(text);
    } catch { /* user cancelled */ }
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--background))]">
      <header className="sticky top-0 z-40 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
            <ChevronLeft className="h-4 w-4" />Dashboard
          </Link>
          <div className="ml-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[rgb(var(--primary))]" />
            <span className="text-sm font-medium">Speaking Report</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[rgb(var(--foreground))] sm:text-4xl">Результаты: Спикинг</h1>
            <p className="mt-1 text-base text-[rgb(var(--muted-foreground))]">
              Завершено {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date())} г.
            </p>
          </div>
          <Button variant="outline" className="gap-2 rounded-xl shadow-sm" onClick={shareReport}>
            <Share2 className="h-4 w-4" />
            Поделиться
          </Button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-lg">
          <div className="h-1.5 bg-[#1473E6]" />
          <div className="grid gap-8 p-6 lg:grid-cols-[260px_1fr] lg:p-8">
            <div className="flex justify-center lg:justify-start">
              <div className="relative flex h-48 w-48 items-center justify-center rounded-full" style={scoreArcStyle(overall)}>
                <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full bg-[rgb(var(--surface))]">
                  <span className="font-mono text-6xl font-bold text-[rgb(var(--foreground))]">{overall.toFixed(1)}</span>
                  <span className="text-sm font-medium text-[rgb(var(--muted-foreground))]">из 9.0</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-6">
              <div>
                <h2 className="text-2xl font-bold text-[rgb(var(--foreground))]">Общий балл IELTS</h2>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Badge className="rounded-full bg-[#1473E6] px-4 py-1.5 text-sm text-white hover:bg-[#1473E6]">CEFR {cefr}</Badge>
                  <span className="text-base text-[rgb(var(--muted-foreground))]">{bandDescriptor(overall)}</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {criteriaCards.map((c) => (
                  <div key={c.code} className="rounded-xl bg-[rgb(var(--surface-elevated))] p-4 text-center">
                    <div className="font-mono text-2xl font-bold text-[rgb(var(--foreground))]">{c.band.toFixed(1)}</div>
                    <div className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">{c.short}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[rgb(var(--border))] pt-8">
          <h2 className="mb-5 text-2xl font-bold text-[rgb(var(--foreground))]">Оценка по критериям</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {criteriaCards.map((c) => {
              const level = c.band >= 7 ? "high" : c.band >= 5 ? "mid" : "low";
              const comment = c.comment || CRITERIA_DESCRIPTIONS[c.code]?.[level] || feedback.summary;
              return (
                <div key={c.code} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CRITERIA_COLORS[c.code] }} />
                      <h3 className="font-semibold text-[rgb(var(--foreground))]">{c.name}</h3>
                    </div>
                    <span className="font-mono text-3xl font-bold text-[rgb(var(--foreground))]">{c.band.toFixed(1)}</span>
                  </div>
                  <p className="text-base leading-relaxed text-[rgb(var(--muted-foreground))]">{comment}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-5 text-2xl font-bold text-[rgb(var(--foreground))]">Быстрый обзор</h2>
          <div className="grid gap-5 lg:grid-cols-3">
            <QuickReviewCard title="Грамматика" color="#EF4444" items={grammarFixes} empty="Критичных грамматических правок не найдено." />
            <QuickReviewCard title="Лексика" color="#F59E0B" items={vocabFixes.length ? vocabFixes : feedback.model_phrases.map((phrase) => ({ issue: "Улучшить лексику", example: "basic phrase", correction: phrase, suggestion: "Используйте эту фразу в похожем ответе." }))} empty="Добавьте больше точной тематической лексики." />
            <PronunciationReviewCard items={pronunciationFixes} />
          </div>
        </section>

        <section>
          <h2 className="mb-5 text-2xl font-bold text-[rgb(var(--foreground))]">Детальный анализ по частям</h2>
          <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-sm">
            <div className="grid border-b border-[rgb(var(--border))] sm:grid-cols-3">
              {visibleTopics.map((topic, index) => (
                <button
                  key={topic.id ?? index}
                  type="button"
                  onClick={() => setActivePart(index)}
                  className={cn(
                    "border-b-2 px-4 py-4 text-base transition-colors",
                    activePart === index ? "border-[#1473E6] text-[rgb(var(--foreground))]" : "border-transparent text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]",
                  )}
                >
                  Part {topic.part ?? index + 1} <span className="text-sm text-[rgb(var(--muted-foreground))]">{index === 1 ? "120с" : "15с"}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 border-b border-[rgb(var(--border))] px-6 py-4">
              <button type="button" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1473E6] text-white">
                <Play className="h-5 w-5 fill-current" />
              </button>
              <span className="font-mono text-sm text-[rgb(var(--muted-foreground))]">0:00</span>
              <div className="h-2 flex-1 rounded-full bg-blue-100">
                <div className="h-full w-1/4 rounded-full bg-blue-300" />
              </div>
              <span className="font-mono text-sm text-[rgb(var(--muted-foreground))]">{activePart === 1 ? "2:00" : "0:15"}</span>
            </div>

            <div className="grid lg:grid-cols-[1fr_1fr]">
              <div className="border-b border-[rgb(var(--border))] p-6 lg:border-b-0 lg:border-r">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Mic2 className="h-5 w-5 text-[rgb(var(--muted-foreground))]" />
                    <span className="text-lg font-semibold text-[rgb(var(--foreground))]">Ваш ответ</span>
                  </div>
                  <div className="inline-flex rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-elevated))] p-1">
                    <button type="button" onClick={() => setAnswerView("original")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", answerView === "original" ? "bg-[rgb(var(--surface))] shadow-sm" : "text-[rgb(var(--muted-foreground))]")}>
                      <Eye className="h-4 w-4" />
                      Original
                    </button>
                    <button type="button" onClick={() => setAnswerView("feedback")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", answerView === "feedback" ? "bg-[rgb(var(--surface))] shadow-sm" : "text-[rgb(var(--muted-foreground))]")}>
                      <MessageCircle className="h-4 w-4" />
                      Feedback
                    </button>
                  </div>
                </div>

                <div className="mb-5 flex gap-6 text-sm">
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" />Good pause</span>
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-rose-500" />Bad pause</span>
                </div>

                <div className="flex flex-col gap-5">
                  {(activeTopic?.questions ?? [activeTopic?.topic_text].filter(Boolean) as string[]).slice(0, 5).map((question, index) => (
                    <div key={`${question}-${index}`} className="flex flex-col gap-2">
                      <p className="text-base italic leading-relaxed text-indigo-500">{question}</p>
                      <div className="flex items-center gap-2 text-sm text-[rgb(var(--muted-foreground))]">
                        <button type="button" className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                          <Play className="h-3 w-3 fill-current" />
                        </button>
                        <span className="font-mono">0:{String(index * 3).padStart(2, "0")} - 0:{String(index * 3 + 2).padStart(2, "0")}</span>
                      </div>
                    </div>
                  ))}
                  <p className={cn("whitespace-pre-wrap text-lg leading-relaxed", answerView === "feedback" ? "text-[rgb(var(--foreground))]" : "text-[rgb(var(--muted-foreground))]")}>
                    {activeTranscript || "Транскрипт недоступен."}
                  </p>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6 flex flex-wrap gap-3">
                  {detailTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAnalysisTab(tab.id)}
                      className={cn(
                        "rounded-xl px-4 py-2 text-base font-medium transition-colors",
                        analysisTab === tab.id ? "bg-[#1473E6] text-white" : "bg-[rgb(var(--surface-elevated))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <h3 className="mb-5 text-xl font-bold text-[rgb(var(--foreground))]">{activeCriterion.short} Analysis</h3>
                {analysisTab === "fluency" ? (
                  <FluencyAnalysis wpm={wpm} hesitationCount={hesitationCount} fillerCount={fillerCount} duration={activePart === 1 ? 120 : 15} />
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-2xl bg-[rgb(var(--surface-elevated))] p-5">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold text-[rgb(var(--foreground))]">{activeCriterion.name}</span>
                        <span className="font-mono text-2xl font-bold">{activeCriterion.band.toFixed(1)}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-[rgb(var(--muted-foreground))]">
                        {activeCriterion.comment || CRITERIA_DESCRIPTIONS[activeCriterion.code]?.[activeCriterion.band >= 7 ? "high" : activeCriterion.band >= 5 ? "mid" : "low"]}
                      </p>
                    </div>
                    {(activeImprovements.length ? activeImprovements : feedback.improvements.slice(0, 2)).map((imp, index) => (
                      <div key={index} className="rounded-xl border border-[rgb(var(--border))] p-4">
                        <p className="font-semibold text-[rgb(var(--foreground))]">{imp.issue}</p>
                        {imp.example && (
                          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                            <p className="text-sm text-rose-600 line-through">{cleanSpeakingText(imp.example)}</p>
                            <ArrowRight className="hidden h-4 w-4 text-[rgb(var(--muted-foreground))] sm:block" />
                            <p className="text-sm font-medium text-emerald-700">{cleanSpeakingText(imp.correction) || imp.suggestion}</p>
                          </div>
                        )}
                        <p className="mt-2 text-sm text-[rgb(var(--muted-foreground))]">{imp.suggestion}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-5 text-2xl font-bold text-[rgb(var(--foreground))]">Сильные стороны и рекомендации</h2>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-[rgb(var(--surface))] p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <h3 className="text-lg font-semibold text-[rgb(var(--foreground))]">Сильные стороны</h3>
              </div>
              <ul className="flex flex-col gap-4">
                {(feedback.strengths.length ? feedback.strengths : ["Вы завершили Speaking-попытку и получили транскрипт для анализа."]).map((item, index) => (
                  <li key={index} className="flex gap-3 text-base leading-relaxed text-[rgb(var(--muted-foreground))]">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-orange-200 bg-[rgb(var(--surface))] p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <Gauge className="h-5 w-5 text-orange-500" />
                <h3 className="text-lg font-semibold text-[rgb(var(--foreground))]">Рекомендации</h3>
              </div>
              <ul className="flex flex-col gap-4">
                {recommendations.slice(0, 4).map((item, index) => (
                  <li key={index} className="flex gap-3 text-base leading-relaxed text-[rgb(var(--muted-foreground))]">
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-orange-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {feedback.model_phrases?.length > 0 && (
          <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
            <div className="mb-4 font-semibold text-[rgb(var(--foreground))]">Полезные фразы</div>
            <div className="flex flex-wrap gap-2">
              {feedback.model_phrases.map((phrase, index) => (
                <span key={index} className="rounded-full bg-[rgb(var(--primary)/0.08)] px-3 py-1.5 text-sm font-medium text-[rgb(var(--primary))]">{phrase}</span>
              ))}
            </div>
          </section>
        )}

        {topics[1]?.sample_answer && (
          <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
            <button onClick={() => setShowSample(!showSample)} className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-[rgb(var(--foreground))]">Образец ответа Band 8+</span>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-[rgb(var(--muted-foreground))] transition-transform", showSample && "rotate-180")} />
            </button>
            {showSample && (
              <div className="mt-4 border-t border-amber-200 pt-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[rgb(var(--foreground))]">{topics[1].sample_answer}</p>
              </div>
            )}
          </section>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" asChild><Link href="/dashboard">Dashboard</Link></Button>
          <Button className="flex-1" onClick={onRetry}>Ещё практика</Button>
        </div>
      </main>
    </div>
  );
}

function QuickReviewCard({
  title,
  color,
  items,
  empty,
}: {
  title: string;
  color: string;
  items: Array<Pick<SpeakingFeedback["improvements"][number], "issue" | "example" | "suggestion" | "correction" | "severity" | "from_band" | "to_band">>;
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="text-lg font-semibold text-[rgb(var(--foreground))]">{title}</h3>
      </div>
      <div className="flex flex-col gap-4">
        {items.length > 0 ? items.slice(0, 5).map((item, index) => {
          const example = cleanSpeakingText(item.example);
          const correction = cleanSpeakingText(item.correction) || item.suggestion;
          return (
            <div key={index} className="text-base leading-relaxed">
              {example && <span className="text-rose-600 line-through decoration-2">{example}</span>}
              {example && <span className="mx-1 text-[rgb(var(--muted-foreground))]">→</span>}
              <span className="text-emerald-700">{correction}</span>
              {item.severity === "major" && <Badge className="ml-2 rounded-full bg-rose-500 text-white hover:bg-rose-500">major</Badge>}
              {item.from_band && item.to_band && (
                <Badge variant="secondary" className="ml-2 rounded-full">Band {item.from_band} → Band {item.to_band}</Badge>
              )}
            </div>
          );
        }) : (
          <p className="text-base text-[rgb(var(--muted-foreground))]">{empty}</p>
        )}
      </div>
    </div>
  );
}

function PronunciationReviewCard({ items }: { items: SpeakingFeedback["improvements"] }) {
  const fallback = [
    { word: "that", sound: "/ðæt/" },
    { word: "we", sound: "/wiː/" },
    { word: "just", sound: "/dʒʌst/" },
    { word: "have", sound: "/hæv/" },
  ];
  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <span className="h-3 w-3 rounded-full bg-purple-500" />
        <h3 className="text-lg font-semibold text-[rgb(var(--foreground))]">Произношение</h3>
      </div>
      <div className="flex flex-col gap-3">
        {(items.length > 0 ? items.slice(0, 5).map((item) => ({ word: cleanSpeakingText(item.example || item.issue), sound: item.correction || item.suggestion })) : fallback).map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="text-base text-[rgb(var(--foreground))]">{item.word}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[rgb(var(--muted-foreground))]">{item.sound}</span>
              <Badge variant="outline" className="rounded-full border-rose-300 text-rose-600">10%</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FluencyAnalysis({
  wpm,
  hesitationCount,
  fillerCount,
  duration,
}: {
  wpm: number;
  hesitationCount: number;
  fillerCount: number;
  duration: number;
}) {
  const marker = Math.min(96, Math.max(2, ((wpm - 60) / 140) * 100));
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-[rgb(var(--surface-elevated))] p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-[#1473E6]">
              <Sparkles className="h-6 w-6" />
            </div>
            <span className="text-base text-[rgb(var(--muted-foreground))]">Speaking Speed</span>
          </div>
          <div className="text-right">
            <div className="font-mono text-5xl font-bold text-[rgb(var(--foreground))]">{wpm}</div>
            <div className="text-sm text-[rgb(var(--muted-foreground))]">words/minute</div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-[rgb(var(--surface-elevated))] p-6">
        <div className="mb-5 flex items-center gap-3">
          <Clock className="h-5 w-5 text-[rgb(var(--muted-foreground))]" />
          <span className="text-lg font-semibold text-[rgb(var(--foreground))]">Speech Analysis</span>
        </div>
        <div className="mb-2 flex justify-between text-sm text-[rgb(var(--muted-foreground))]">
          {[60, 90, 120, 150, 180, 200].map((n) => <span key={n}>{n}</span>)}
        </div>
        <div className="relative h-5 rounded-full" style={{ background: "linear-gradient(to right, #EF4444, #F59E0B, #22C55E 42%, #22C55E 62%, #F59E0B, #EF4444)" }}>
          <span className="absolute top-0 h-5 w-2 rounded-full bg-[rgb(var(--foreground))]" style={{ left: `${marker}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-rose-500">Too Slow</span>
          <span className="text-emerald-600">Normal</span>
          <span className="text-rose-500">Too Fast</span>
        </div>
      </div>
      <div className="rounded-2xl bg-blue-50 p-5 text-blue-700">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm leading-relaxed">Examiners will most likely enjoy your speaking if you speak using around 120 to 150 words per minute.</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-[rgb(var(--surface-elevated))] p-4 text-center">
          <div className="text-3xl font-bold">{hesitationCount}</div>
          <div className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">Hesitations</div>
        </div>
        <div className="rounded-xl bg-[rgb(var(--surface-elevated))] p-4 text-center">
          <div className="text-3xl font-bold">{Math.max(0, Math.round(duration / 35) - hesitationCount)}</div>
          <div className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">Good Pauses</div>
        </div>
        <div className="rounded-xl bg-[rgb(var(--surface-elevated))] p-4 text-center">
          <div className="text-3xl font-bold">{fillerCount}</div>
          <div className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">Fillers</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-[rgb(var(--muted-foreground))]">
        <Timer className="h-4 w-4" />
        Duration: {duration}s
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SpeakingReport({
  feedback,
  topics,
  showSample,
  setShowSample,
  onRetry,
}: {
  feedback: SpeakingFeedback;
  topics: Topic[];
  showSample: boolean;
  setShowSample: (v: boolean) => void;
  onRetry: () => void;
}) {
  const [expandedCriteria, setExpandedCriteria] = useState<string | null>("FC");
  const [activeTab, setActiveTab] = useState<string>("fluency");

  const overall = feedback.overall_band;
  const cefr = bandToCEFR(overall);

  const criteriaList = [
    { code: "FC", name: "Fluency and Coherence", band: feedback.fluency_coherence },
    { code: "LR", name: "Lexical Resource", band: feedback.lexical_resource },
    { code: "GRA", name: "Grammatical Range and Accuracy", band: feedback.grammatical_range },
    { code: "PR", name: "Pronunciation", band: feedback.pronunciation },
  ];

  const DETAIL_TABS = [
    { id: "fluency", label: "Fluency", code: "FC" },
    { id: "vocabulary", label: "Vocabulary", code: "LR" },
    { id: "pronunciation", label: "Pronunciation", code: "PR" },
    { id: "grammar", label: "Grammar", code: "GRA" },
  ];

  const wordCount = feedback.transcript?.split(/\s+/).filter(Boolean).length ?? 0;

  const bandLevel = (b: number) => b >= 7 ? "high" : b >= 5 ? "mid" : "low";
  const bandColorFn = (b: number) => b >= 7 ? "text-[rgb(var(--band-high))]" : b >= 5.5 ? "text-[rgb(var(--band-mid))]" : b >= 4 ? "text-amber-600" : "text-[rgb(var(--band-low))]";

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col">
      <header className="sticky top-0 z-40 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
            <ChevronLeft className="w-4 h-4" />Dashboard
          </Link>
          <div className="flex items-center gap-2 ml-2">
            <Sparkles className="w-4 h-4 text-[rgb(var(--primary))]" />
            <span className="font-medium text-sm">Speaking Report</span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-5">

        {/* ── Score header ── */}
        <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
          <div className="flex items-center gap-6">
            <div className="flex items-baseline gap-1">
              <span className={cn("font-mono text-5xl font-bold", bandColorFn(overall))}>{overall.toFixed(1)}</span>
              <span className="text-xl text-[rgb(var(--muted-foreground))] font-light">/9.0</span>
            </div>
            <div className="h-12 w-px bg-[rgb(var(--border))]" />
            <div>
              <div className="text-2xl font-bold text-[rgb(var(--foreground))]">{cefr}</div>
              <div className="text-xs text-[rgb(var(--muted-foreground))]">CEFR</div>
            </div>
          </div>
          <p className="text-sm text-[rgb(var(--muted-foreground))] mt-4 leading-relaxed">{feedback.summary}</p>
        </div>

        {/* ── Criteria accordion cards ── */}
        <div className="flex flex-col gap-3">
          {criteriaList.map((c) => {
            const isOpen = expandedCriteria === c.code;
            const color = CRITERIA_COLORS[c.code];
            const level = bandLevel(c.band);
            const desc = CRITERIA_DESCRIPTIONS[c.code]?.[level] ?? "";
            const relatedImprovements = feedback.improvements.filter((imp) => criteriaFilter(c.code, imp.issue));

            return (
              <div
                key={c.code}
                className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden"
                style={{ borderLeftWidth: "4px", borderLeftColor: color }}
              >
                <button
                  onClick={() => setExpandedCriteria(isOpen ? null : c.code)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-[rgb(var(--muted)/0.03)] transition-colors"
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="font-semibold text-sm text-[rgb(var(--foreground))] flex-1 text-left">{c.name}</span>
                  <span className={cn("font-mono text-lg font-bold", bandColorFn(c.band))}>{c.band.toFixed(1)}</span>
                  <ChevronDown className={cn("w-4 h-4 text-[rgb(var(--muted-foreground))] transition-transform", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-[rgb(var(--border))]">
                    <div className="mt-3 mb-3">
                      <div className="h-2 bg-[rgb(var(--surface-elevated))] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(c.band / 9) * 100}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>

                    <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed mb-3">{desc}</p>

                    {relatedImprovements.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {relatedImprovements.map((imp, i) => (
                          <div key={i} className="bg-[rgb(var(--background))] rounded-lg p-3">
                            <p className="text-sm font-medium text-[rgb(var(--foreground))] mb-0.5">{imp.issue}</p>
                            {imp.example && (
                              <p className="text-xs text-[rgb(var(--muted-foreground))] italic mb-1">«{imp.example}»</p>
                            )}
                            <p className="text-sm text-[rgb(var(--foreground))]">{imp.suggestion}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Detailed Feedback ── */}
        <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[rgb(var(--border))]">
            <h3 className="font-bold text-[rgb(var(--foreground))]">Detailed Feedback</h3>
          </div>

          {feedback.transcript && !feedback.transcript.includes("[Audio transcription unavailable") && (
            <div className="px-5 py-4 border-b border-[rgb(var(--border))]">
              <p className="text-xs font-medium text-[rgb(var(--muted-foreground))] uppercase tracking-wider mb-2">Транскрипция</p>
              <p className="text-sm text-[rgb(var(--foreground))] leading-relaxed bg-[rgb(var(--background))] rounded-lg p-3">
                {feedback.transcript}
              </p>
            </div>
          )}

          <div className="flex border-b border-[rgb(var(--border))] overflow-x-auto">
            {DETAIL_TABS.map((tab) => {
              const color = CRITERIA_COLORS[tab.code];
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors flex-1 justify-center",
                    isActive ? "text-white" : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted)/0.05)]"
                  )}
                  style={isActive ? { backgroundColor: color } : undefined}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isActive ? "white" : color }} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-5">
            {DETAIL_TABS.map((tab) => {
              if (activeTab !== tab.id) return null;
              const criteria = criteriaList.find((c) => c.code === tab.code);
              if (!criteria) return null;
              const level = bandLevel(criteria.band);
              const desc = CRITERIA_DESCRIPTIONS[tab.code]?.[level] ?? "";
              const color = CRITERIA_COLORS[tab.code];
              const tabImprovements = feedback.improvements.filter((imp) => criteriaFilter(tab.code, imp.issue));
              const displayImprovements = tabImprovements.length > 0 ? tabImprovements : feedback.improvements.slice(0, 2);

              return (
                <div key={tab.id} className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
                      <span className="font-mono text-xl font-bold" style={{ color }}>{criteria.band.toFixed(1)}</span>
                    </div>
                    <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed">{desc}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-[rgb(var(--foreground))] uppercase tracking-wider">Что улучшить</p>
                    {displayImprovements.map((imp, i) => (
                      <div key={i} className="bg-[rgb(var(--background))] rounded-lg p-3 border border-[rgb(var(--border))]">
                        <p className="text-sm font-medium text-[rgb(var(--foreground))]">{imp.issue}</p>
                        {imp.example && <p className="text-xs text-[rgb(var(--muted-foreground))] italic mt-1">«{imp.example}»</p>}
                        <p className="text-sm text-[rgb(var(--foreground))] mt-1">{imp.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Speech Analysis ── */}
        {wordCount > 0 && (
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5">
            <h3 className="font-bold text-[rgb(var(--foreground))] mb-4">Speech Analysis</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[rgb(var(--background))] rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-[rgb(var(--primary))]">{wordCount}</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))] mt-1">слов в ответе</div>
              </div>
              <div className="bg-[rgb(var(--background))] rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-[rgb(var(--primary))]">{cefr}</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))] mt-1">уровень речи</div>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-[rgb(var(--muted-foreground))] mb-2">Темп речи</p>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, #EF4444, #F59E0B, #22C55E, #22C55E, #F59E0B, #EF4444)" }}>
                <div className="relative h-full">
                  <div
                    className="absolute top-0 w-1 h-full bg-[rgb(var(--foreground))] rounded-full shadow-md"
                    style={{ left: `${Math.min(95, Math.max(5, wordCount > 200 ? 70 : wordCount > 120 ? 50 : wordCount > 60 ? 30 : 15))}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-[rgb(var(--muted-foreground))]">
                <span>Too Slow</span>
                <span>Normal</span>
                <span>Too Fast</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Strengths ── */}
        {feedback.strengths.length > 0 && (
          <div className="bg-[rgb(var(--success)/0.06)] border border-[rgb(var(--success)/0.2)] rounded-2xl p-5">
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

        {/* ── Model phrases ── */}
        {feedback.model_phrases?.length > 0 && (
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-5">
            <div className="font-semibold text-sm mb-3">Полезные фразы</div>
            <div className="flex flex-wrap gap-2">
              {feedback.model_phrases.map((p, i) => (
                <span key={i} className="text-xs bg-[rgb(var(--primary)/0.08)] text-[rgb(var(--primary))] rounded-full px-3 py-1.5 font-medium">{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Sample answer ── */}
        {topics[1]?.sample_answer && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
            <button onClick={() => setShowSample(!showSample)} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="font-semibold text-sm text-[rgb(var(--foreground))]">Образец ответа Band 8+</span>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-[rgb(var(--muted-foreground))] transition-transform", showSample && "rotate-180")} />
            </button>
            {showSample && (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <p className="text-sm text-[rgb(var(--foreground))] leading-relaxed whitespace-pre-wrap">{topics[1].sample_answer}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" asChild><Link href="/dashboard">Dashboard</Link></Button>
          <Button className="flex-1" onClick={onRetry}>Ещё практика</Button>
        </div>
      </div>
    </div>
  );
}
