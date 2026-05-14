"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight,
  BookOpen, CheckCircle2, XCircle,
  Loader2, Eye, RotateCcw, MessageCircle,
  LayoutPanelLeft, AlignJustify,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNextReading, saveAttempt } from "@/lib/supabase/queries";
import { ErrorAnalysis } from "@/components/error-analysis";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "intro" | "test" | "results";
type View = "split" | "passage" | "questions";

type ReadingQuestion = {
  id: string;
  passageIdx: number;
  type: "mcq" | "tfng" | "fill";
  instruction: string;
  text: string;
  options: string[];
  answer: number;
  isMCQ: boolean;
  correctText: string;
};

type Passage = {
  index: number;
  text: string;
  questions: ReadingQuestion[];
};

type ReadingTest = {
  id: string;
  title: string;
  source: string;
  category: string;
  passages: Passage[];
};

type AnswerValue = number | string;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function answerToIndex(answer: string, options: string[]): number {
  const upper = answer.trim().toUpperCase();
  if (/^[A-D]$/.test(upper)) return upper.charCodeAt(0) - 65;
  const idx = options.findIndex((o) => o.toUpperCase() === upper);
  return idx >= 0 ? idx : 0;
}

function checkAnswer(q: ReadingQuestion, value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;
  if (q.isMCQ) return value === q.answer;
  if (typeof value !== "string") return false;
  const norm = (s: string) => s.toLowerCase().trim().replace(/[.,!?;:]+$/, "");
  return norm(value) === norm(q.correctText);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbToTest(raw: any): ReadingTest {
  const passages: Passage[] = [];
  const sections = raw.sections ?? [];

  sections.forEach((section: any, sIdx: number) => {
    const questions: ReadingQuestion[] = [];
    for (const group of section.reading_question_groups ?? []) {
      const instruction = (group.instruction as string) ?? "";
      const groupType: "mcq" | "tfng" = group.question_type === "tfng" ? "tfng" : "mcq";
      for (const q of group.reading_questions ?? []) {
        let raw_opts = q.options;
        if (typeof raw_opts === "string") {
          try { raw_opts = JSON.parse(raw_opts); } catch { raw_opts = null; }
        }
        let opts: string[] = [];
        let qType: "mcq" | "tfng" | "fill" = groupType;
        let isMCQ = false;
        if (Array.isArray(raw_opts) && raw_opts.length > 0) {
          opts = raw_opts;
          isMCQ = true;
        } else if (raw_opts && typeof raw_opts === "object") {
          opts = Object.values(raw_opts as Record<string, string>);
          isMCQ = opts.length > 0;
        } else if (groupType === "tfng") {
          opts = ["TRUE", "FALSE", "NOT GIVEN"];
          isMCQ = true;
        } else {
          qType = "fill";
        }
        questions.push({
          id: q.id,
          passageIdx: sIdx,
          type: qType,
          instruction,
          text: q.question_text,
          options: opts,
          answer: isMCQ ? answerToIndex(q.correct_answer ?? "", opts) : 0,
          isMCQ,
          correctText: (q.correct_answer ?? "").trim(),
        });
      }
    }
    passages.push({
      index: sIdx,
      text: section.passage_text as string,
      questions,
    });
  });

  return {
    id: raw.id,
    title: raw.title,
    source: raw.source,
    category: raw.category ?? "academic",
    passages,
  };
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

const FALLBACK_TEST: ReadingTest = {
  id: "fallback",
  title: "The Psychology of Decision Making",
  source: "Sample",
  category: "academic",
  passages: [
    {
      index: 0,
      text: "Daniel Kahneman, who won the Nobel Prize in Economics in 2002, proposed a dual-process theory of thought. System 1 thinking is fast, automatic and largely unconscious; it handles routine judgements and relies on heuristics — mental shortcuts that usually work but can occasionally lead us astray. System 2 thinking, by contrast, is slow, deliberate and effortful; it is engaged when we face complex problems that require careful analysis.",
      questions: [
        { id: "q1", passageIdx: 0, type: "mcq", instruction: "Choose A, B or C.", text: "What did Kahneman propose?",
          options: ["Rational-actor model", "Dual-process theory", "Anchoring effect"], answer: 1, isMCQ: true, correctText: "B" },
        { id: "q2", passageIdx: 0, type: "tfng", instruction: "TRUE / FALSE / NOT GIVEN", text: "System 1 thinking is slow and effortful.",
          options: ["TRUE", "FALSE", "NOT GIVEN"], answer: 1, isMCQ: true, correctText: "FALSE" },
      ],
    },
  ],
};

// ─── Components ───────────────────────────────────────────────────────────────

function QuestionInput({
  q, number, value, onChange, showResult,
}: {
  q: ReadingQuestion;
  number: number;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  showResult: boolean;
}) {
  const correct = showResult && checkAnswer(q, value);
  const incorrect = showResult && value !== undefined && !correct;
  const empty = showResult && value === undefined;

  return (
    <div className="flex flex-col gap-2 pb-5 border-b border-[rgb(var(--border))] last:border-0 last:pb-0">
      {q.instruction && (
        <p className="text-[11px] text-[rgb(var(--muted-foreground))] italic">{q.instruction}</p>
      )}
      <div className="flex gap-3 items-start">
        <span className={cn(
          "shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold",
          showResult
            ? correct ? "bg-green-100 text-green-700"
              : empty ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-700"
            : "bg-[rgb(var(--primary)/0.08)] text-[rgb(var(--primary))]"
        )}>{number}</span>
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
                onClick={() => !showResult && onChange(i)}
                disabled={showResult}
                className={cn(
                  "text-left px-3.5 py-2 rounded-lg border text-sm transition-all flex items-center gap-2.5",
                  showResult && isCorrectOpt && "border-green-300 bg-green-50",
                  showResult && selected && !isCorrectOpt && "border-red-300 bg-red-50",
                  !showResult && selected && "border-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.06)]",
                  !showResult && !selected && "border-[rgb(var(--border))] hover:border-[rgb(var(--primary)/0.4)]"
                )}
              >
                <span className={cn(
                  "w-3.5 h-3.5 rounded-full border shrink-0",
                  selected ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))]" : "border-[rgb(var(--muted-foreground))]"
                )} />
                <span className="text-[rgb(var(--foreground))]">
                  {q.type === "tfng" ? opt : <><span className="font-bold mr-1">{String.fromCharCode(65 + i)}.</span>{opt}</>}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="ml-10">
          <Input
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => !showResult && onChange(e.target.value)}
            disabled={showResult}
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

function ReviewQuestion({
  q, number, value, onRetry, askAI,
}: {
  q: ReadingQuestion;
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
              {typeof value === "number" ? (q.type === "tfng" ? q.options[value] : `${String.fromCharCode(65 + value)}. ${q.options[value]}`) : "—"}
            </span>
            {showAnswer && !correct && (
              <div className="mt-1">
                <span className="text-[rgb(var(--muted-foreground))]">Правильный: </span>
                <span className="font-medium text-green-700">
                  {q.type === "tfng" ? q.options[q.answer] : `${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}`}
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
          <button onClick={onRetry} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[rgb(var(--border))] text-xs font-medium text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.4)] hover:text-[rgb(var(--primary))] transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />Попробовать
          </button>
          <button onClick={() => setShowAnswer((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[rgb(var(--border))] text-xs font-medium text-[rgb(var(--foreground))] hover:border-[rgb(var(--primary)/0.4)] hover:text-[rgb(var(--primary))] transition-colors">
            <Eye className="w-3.5 h-3.5" />{showAnswer ? "Скрыть" : "Показать ответ"}
          </button>
          <button onClick={askAI} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors">
            <MessageCircle className="w-3.5 h-3.5" />Спросить ИИ
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReadingTestPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [test, setTest] = useState<ReadingTest>(FALLBACK_TEST);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitted, setSubmitted] = useState(false);
  const [activePassage, setActivePassage] = useState<number>(-1); // -1 = full test, 0..N = single passage
  const [currentPassage, setCurrentPassage] = useState(0);
  const [view, setView] = useState<View>("split");
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      const sb = createClient();
      try {
        const { data: { user } } = await sb.auth.getUser();
        if (user) userIdRef.current = user.id;
        const raw = user ? await getNextReading(sb, user.id) : null;
        if (raw) {
          const mapped = mapDbToTest(raw);
          if (mapped.passages.length > 0 && mapped.passages.some((p) => p.questions.length > 0)) {
            setTest(mapped);
          }
        }
      } catch (err) {
        console.error("[reading]", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Compute visible passages based on activePassage
  const visiblePassages = activePassage === -1
    ? test.passages
    : test.passages.filter((p, i) => i === activePassage);
  const allVisibleQuestions = visiblePassages.flatMap((p) => p.questions);
  const totalQ = allVisibleQuestions.length;
  const answered = allVisibleQuestions.filter((q) => {
    const v = answers[q.id];
    return v !== undefined && v !== "";
  }).length;

  const handleAnswer = useCallback((qId: string, v: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [qId]: v }));
  }, []);

  async function handleSubmit() {
    setSubmitted(true);
    setPhase("results");
    if (userIdRef.current && test.id !== "fallback") {
      try {
        const sb = createClient();
        const correctCount = allVisibleQuestions.filter((q) => checkAnswer(q, answers[q.id])).length;
        const band = correctCount >= totalQ * 0.9 ? 8.0
          : correctCount >= totalQ * 0.75 ? 7.0
          : correctCount >= totalQ * 0.6 ? 6.0
          : correctCount >= totalQ * 0.45 ? 5.5
          : correctCount >= totalQ * 0.3 ? 5.0
          : 4.0;
        /* eslint-disable @typescript-eslint/no-explicit-any */
        await saveAttempt(sb, {
          user_id: userIdRef.current,
          content_type: "reading",
          content_id: test.id,
          answers: answers as any,
          band_score: band,
          raw_score: correctCount,
          total_questions: totalQ,
          time_spent: null,
          ai_feedback: null,
          completed_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[reading] save:", err);
      }
    }
  }

  function startTest(passageIdx: number) {
    setActivePassage(passageIdx);
    setCurrentPassage(passageIdx === -1 ? 0 : passageIdx);
    setPhase("test");
    setAnswers({});
    setSubmitted(false);
  }

  function retryQuestion(qId: string) {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  }

  function askAI(q: ReadingQuestion) {
    const params = new URLSearchParams({
      q: `Помоги разобрать вопрос из Reading Test: "${q.text}". Я ответил неправильно. Правильный ответ: ${q.isMCQ ? q.options[q.answer] : q.correctText}. Объясни почему и дай совет на будущее.`,
    });
    router.push(`/tutor?${params.toString()}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[rgb(var(--primary))] animate-spin" />
      </div>
    );
  }

  // ── INTRO PHASE
  if (phase === "intro") {
    const totalQuestions = test.passages.reduce((s, p) => s + p.questions.length, 0);
    const categoryLabel = test.category === "general" ? "General Training" : "Academic";

    return (
      <div className="min-h-screen bg-[rgb(var(--background))]">
        <header className="sticky top-0 z-40 bg-white border-b border-[rgb(var(--border))]">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
              <ChevronLeft className="w-4 h-4" />Dashboard
            </Link>
            <div className="flex items-center gap-2 ml-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-[rgb(var(--foreground))]">{test.title}</span>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl border border-[rgb(var(--border))] shadow-sm p-8 flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-blue-500" />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-[rgb(var(--foreground))] mb-2">IELTS {categoryLabel} Reading</h1>
              <p className="text-sm text-[rgb(var(--muted-foreground))]">
                {test.passages.length} текст{test.passages.length > 1 ? "а" : ""} с вопросами на понимание прочитанного
              </p>
            </div>

            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">60 мин</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">Время</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">{totalQuestions}</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">Вопросов</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">{test.passages.length}</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">Секций</div>
              </div>
            </div>

            <div className="text-left w-full">
              <h2 className="font-semibold text-[rgb(var(--foreground))] mb-3">Формат теста</h2>
              <ul className="space-y-2 text-sm text-[rgb(var(--muted-foreground))]">
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>{test.passages.length === 3 ? "3 длинных академических текста с нарастающей сложностью" : `${test.passages.length} текст${test.passages.length > 1 ? "ов" : ""} академического уровня`}</li>
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>Типы вопросов: True/False/Not Given, заполнение пропусков, множественный выбор</li>
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>Все секции доступны сразу — распределяйте время самостоятельно</li>
                <li className="flex gap-2"><span className="text-[rgb(var(--primary))]">•</span>Оценка: Band Score от 1 до 9</li>
              </ul>
            </div>

            <div className="w-full bg-[rgb(var(--muted)/0.05)] rounded-lg px-4 py-2.5 text-xs text-[rgb(var(--muted-foreground))] text-center">
              🌐 Тест проводится полностью на английском языке
            </div>

            <button
              onClick={() => startTest(-1)}
              className="w-full bg-[rgb(var(--primary))] hover:bg-[rgb(var(--primary)/0.92)] text-white font-semibold py-3.5 px-5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md shadow-[rgb(var(--primary)/0.25)]"
            >
              Начать тест Reading
              <ChevronRight className="w-4 h-4" />
            </button>

            {test.passages.length > 1 && (
              <>
                <div className="relative w-full flex items-center gap-3">
                  <div className="flex-1 h-px bg-[rgb(var(--border))]" />
                  <span className="text-[10px] uppercase tracking-widest text-[rgb(var(--muted-foreground))]">Или практикуйте по секциям</span>
                  <div className="flex-1 h-px bg-[rgb(var(--border))]" />
                </div>
                <div className={cn(
                  "grid gap-2 w-full",
                  test.passages.length === 3 ? "grid-cols-3" : "grid-cols-2"
                )}>
                  {test.passages.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => startTest(i)}
                      className="rounded-xl border border-[rgb(var(--border))] hover:border-[rgb(var(--primary)/0.4)] hover:bg-[rgb(var(--primary)/0.03)] py-2.5 px-3 text-sm font-medium text-[rgb(var(--foreground))] transition-all"
                    >
                      Passage {i + 1}
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
    const correctCount = allVisibleQuestions.filter((q) => checkAnswer(q, answers[q.id])).length;
    const band = correctCount >= totalQ * 0.9 ? 8.0
      : correctCount >= totalQ * 0.75 ? 7.0
      : correctCount >= totalQ * 0.6 ? 6.0
      : correctCount >= totalQ * 0.45 ? 5.5
      : correctCount >= totalQ * 0.3 ? 5.0
      : 4.0;
    const bandColor = band >= 7 ? "text-[rgb(var(--band-high))]" : band >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]";

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
              <BookOpen className="w-4 h-4 text-blue-500" />
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

          {allVisibleQuestions.some((q) => q.isMCQ) && (
            <ErrorAnalysis
              questions={allVisibleQuestions.filter((q) => q.isMCQ).map((q) => ({
                id: q.id, instruction: q.instruction, text: q.text, options: q.options, answer: q.answer,
              }))}
              userAnswers={numericAnswers}
            />
          )}

          <div className="bg-white border border-[rgb(var(--border))] rounded-2xl p-6">
            <h2 className="font-semibold text-[rgb(var(--foreground))] mb-5">Разбор по вопросам</h2>
            <div className="flex flex-col gap-3">
              {allVisibleQuestions.map((q, i) => (
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
  const passage = test.passages[currentPassage];
  const isFullTest = activePassage === -1;
  const showPassageTabs = isFullTest && test.passages.length > 1;
  const isFirstPassage = currentPassage === (isFullTest ? 0 : activePassage);
  const isLastPassage = currentPassage >= test.passages.length - 1 || (!isFullTest);

  function goNext() {
    if (isLastPassage) {
      handleSubmit();
    } else {
      setCurrentPassage((p) => p + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goPrev() {
    if (!isFirstPassage) {
      setCurrentPassage((p) => p - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[rgb(var(--background))]">
      <header className="shrink-0 bg-white border-b border-[rgb(var(--border))]">
        <div className="h-13 flex items-center gap-3 px-4">
          <button onClick={() => setPhase("intro")} className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
            <ChevronLeft className="w-4 h-4" />Выход
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <BookOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-sm font-medium text-[rgb(var(--foreground))] truncate">{test.title}</span>
          </div>

          {showPassageTabs && (
            <div className="flex gap-1">
              {test.passages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPassage(i)}
                  className={cn(
                    "w-7 h-7 rounded-md text-xs font-bold transition-colors",
                    i === currentPassage
                      ? "bg-[rgb(var(--primary))] text-white"
                      : "bg-[rgb(var(--muted)/0.08)] text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted)/0.15)]"
                  )}
                >{i + 1}</button>
              ))}
            </div>
          )}

          <span className="text-xs font-mono text-[rgb(var(--muted-foreground))] shrink-0 ml-2">
            {answered}/{totalQ}
          </span>

          <button
            onClick={() => {
              const params = new URLSearchParams({
                q: `Помоги с Reading Passage ${currentPassage + 1}: "${passage.text.slice(0, 250)}..." Подскажи стратегию ответа на этот тип вопросов и как находить ключевые слова в тексте.`,
              });
              window.open(`/tutor?${params.toString()}`, "_blank");
            }}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-50 border border-violet-200 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors shrink-0 ml-2"
          >
            <MessageCircle className="w-3 h-3" />Спросить ИИ
          </button>

          <div className="hidden md:flex bg-[rgb(var(--muted)/0.05)] p-0.5 rounded-md ml-2">
            <button
              onClick={() => setView("split")}
              className={cn("p-1.5 rounded", view === "split" && "bg-white shadow-sm")}
              title="Split view"
            >
              <LayoutPanelLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView("passage")}
              className={cn("p-1.5 rounded", view === "passage" && "bg-white shadow-sm")}
              title="Только текст"
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Passage */}
        {(view === "split" || view === "passage") && (
          <div className={cn(
            "overflow-y-auto p-5 sm:p-6 bg-white border-b md:border-b-0 md:border-r border-[rgb(var(--border))]",
            view === "split" ? "md:w-1/2 max-h-[40vh] md:max-h-none" : "flex-1"
          )}>
            <div className="max-w-2xl mx-auto">
              <Badge className="mb-3 bg-blue-50 text-blue-700 border border-blue-200">Passage {currentPassage + 1}</Badge>
              <div className="passage-text select-text cursor-text">
                {passage.text.split("\n\n").filter(Boolean).map((para, i) => (
                  <p key={i} className="mb-4 last:mb-0 text-[15px] leading-relaxed text-[rgb(var(--foreground))]">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Questions */}
        {(view === "split" || view === "questions") && (
          <div className={cn(
            "overflow-y-auto p-5 sm:p-6",
            view === "split" ? "md:w-1/2" : "flex-1"
          )}>
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-50 text-blue-700 border border-blue-200">Passage {currentPassage + 1}</Badge>
                  <span className="text-xs text-[rgb(var(--muted-foreground))]">
                    {passage.questions.length} вопрос{passage.questions.length === 1 ? "" : "ов"}
                  </span>
                </div>
              </div>

              {passage.questions.length > 0 && (
                <p className="text-xs text-[rgb(var(--muted-foreground))] italic mb-4">
                  {passage.questions[0].instruction}
                </p>
              )}

              <div className="flex flex-col gap-5">
                {passage.questions.map((q, i) => {
                  // Compute global question number
                  let globalIdx = i + 1;
                  if (isFullTest) {
                    globalIdx = test.passages.slice(0, currentPassage).reduce((s, p) => s + p.questions.length, 0) + i + 1;
                  }
                  return (
                    <QuestionInput
                      key={q.id}
                      q={q}
                      number={globalIdx}
                      value={answers[q.id]}
                      onChange={(v) => handleAnswer(q.id, v)}
                      showResult={false}
                    />
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <Button variant="outline" onClick={goPrev} disabled={isFirstPassage} className="gap-1.5 bg-white">
                  <ChevronLeft className="w-4 h-4" />Назад
                </Button>

                {isLastPassage ? (
                  <Button onClick={handleSubmit} className="gap-1.5 shadow-md shadow-[rgb(var(--primary)/0.25)]">
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
        )}
      </div>
    </div>
  );
}
