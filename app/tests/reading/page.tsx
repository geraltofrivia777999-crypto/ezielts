"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatTime } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Clock,
  CheckCircle2,
  XCircle,
  LayoutPanelLeft,
  AlignJustify,
  Flag,
  HelpCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNextReading, saveAttempt } from "@/lib/supabase/queries";
import { ErrorAnalysis } from "@/components/error-analysis";

// ─── Test types ──────────────────────────────────────────────────────────────

type TestQuestion = {
  id: string;
  type: "mcq" | "tfng";
  instruction: string;
  text: string;
  options: string[];
  answer: number;
};

type ReadingTest = {
  id: string;
  title: string;
  source: string;
  timeLimit: number;
  passage: string;
  questions: TestQuestion[];
};

// ─── Answer string → index helper ────────────────────────────────────────────

function answerToIndex(answer: string, options: string[]): number {
  const upper = answer.trim().toUpperCase();
  // Letter: A → 0, B → 1 …
  if (/^[A-D]$/.test(upper)) return upper.charCodeAt(0) - 65;
  // TRUE/FALSE/NOT GIVEN
  const idx = options.findIndex((o) => o.toUpperCase() === upper);
  return idx >= 0 ? idx : 0;
}

// ─── Supabase → TestQuestion mapper ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbToTest(raw: any): ReadingTest {
  const questions: TestQuestion[] = [];
  for (const section of raw.sections ?? []) {
    const passage = section.passage_text as string;
    for (const group of section.reading_question_groups ?? []) {
      const instruction = (group.instruction as string) ?? "";
      const qType: "mcq" | "tfng" = group.question_type === "tfng" ? "tfng" : "mcq";
      for (const q of group.reading_questions ?? []) {
        // q.options can be: array, object, null, or stringified JSON
        let raw_opts = q.options;
        if (typeof raw_opts === "string") {
          try { raw_opts = JSON.parse(raw_opts); } catch { raw_opts = null; }
        }
        let opts: string[];
        if (Array.isArray(raw_opts)) {
          opts = raw_opts;
        } else if (raw_opts && typeof raw_opts === "object") {
          opts = Object.values(raw_opts as Record<string, string>);
        } else {
          opts = qType === "tfng" ? ["TRUE", "FALSE", "NOT GIVEN"] : ["A", "B", "C", "D"];
        }
        questions.push({
          id: q.id,
          type: qType,
          instruction,
          text: q.question_text,
          options: opts,
          answer: answerToIndex(q.correct_answer, opts),
        });
      }
    }
  }
  const firstPassage = raw.sections?.[0]?.passage_text ?? "";
  return {
    id: raw.id,
    title: raw.title,
    source: raw.source,
    timeLimit: 60 * 20,
    passage: firstPassage,
    questions,
  };
}

// ─── Fallback test data ────────────────────────────────────────────────────────

const FALLBACK_TEST: ReadingTest = {
  id: "fallback",
  title: "The Psychology of Decision Making",
  source: "Cambridge IELTS 15",
  timeLimit: 60 * 20, // 20 minutes
  passage: `The process by which humans make decisions has fascinated psychologists, economists, and neuroscientists for decades. Unlike the rational-actor model favoured by classical economists — which assumes that people consistently make choices that maximise their utility — research in behavioural economics has revealed that human decision-making is riddled with predictable irrationalities and cognitive biases.

Daniel Kahneman, who won the Nobel Prize in Economics in 2002, proposed a dual-process theory of thought. System 1 thinking is fast, automatic and largely unconscious; it handles routine judgements and relies on heuristics — mental shortcuts that usually work but can occasionally lead us astray. System 2 thinking, by contrast, is slow, deliberate and effortful; it is engaged when we face complex problems that require careful analysis. The trouble, Kahneman argues, is that people tend to rely on System 1 far more than they realise, even in high-stakes situations.

One of the best-documented cognitive biases is the anchoring effect. When people are asked to make a numerical estimate, the first number they encounter — even if it is entirely arbitrary — exerts a powerful pull on their final judgement. In a famous experiment, participants were asked to spin a wheel that was secretly rigged to stop on either 10 or 65, and then to estimate the percentage of African countries in the United Nations. Those who spun 65 gave significantly higher estimates than those who spun 10, despite the obvious irrelevance of the spinning wheel to the question.

A related phenomenon is the availability heuristic: people judge the probability of an event by how easily examples come to mind. After a plane crash receives saturation media coverage, many travellers temporarily become more fearful of flying, even though the objective risk is unchanged. Similarly, vivid personal experiences lead people to overweight rare but memorable events.

Framing effects demonstrate that the way choices are presented can dramatically alter decisions, even when the underlying options are identical. Patients told that a surgical procedure has a 90 percent survival rate respond far more positively than those told the same procedure has a 10 percent mortality rate. This finding has profound implications for medicine, public policy and marketing.

The status quo bias refers to the tendency to prefer the current state of affairs over change, even when change would be objectively beneficial. Default options exert an enormous influence on behaviour precisely because of this bias. Countries that use an opt-out system for organ donation — where citizens are donors unless they actively choose not to be — have dramatically higher donation rates than opt-in countries, a difference that cannot be explained by differences in attitudes toward donation.

Understanding these biases does not automatically make us immune to them. Research suggests that even experts with extensive training in statistics and probability fall prey to the very biases they study. However, awareness of our cognitive limitations, combined with structural interventions that redesign the choice environment — what Thaler and Sunstein call "nudges" — can meaningfully improve the quality of decisions at both the individual and societal level.`,

  questions: [
    {
      id: "q1",
      type: "mcq" as const,
      instruction: "Choose the correct letter, A, B, C or D.",
      text: "According to the passage, what does the rational-actor model assume?",
      options: [
        "People make decisions based on emotions",
        "People always choose the option that maximises their benefit",
        "People are subject to predictable cognitive biases",
        "People use System 1 thinking for complex problems",
      ],
      answer: 1,
    },
    {
      id: "q2",
      type: "mcq" as const,
      instruction: "Choose the correct letter, A, B, C or D.",
      text: "What does the anchoring experiment with the spinning wheel demonstrate?",
      options: [
        "People can accurately estimate percentages under pressure",
        "Random numbers have no effect on numerical judgements",
        "An irrelevant number can significantly influence an estimate",
        "Participants were aware of the bias affecting their answers",
      ],
      answer: 2,
    },
    {
      id: "q3",
      type: "mcq" as const,
      instruction: "Choose the correct letter, A, B, C or D.",
      text: "The availability heuristic causes people to:",
      options: [
        "Accurately assess statistical probability",
        "Overestimate the likelihood of vivid or memorable events",
        "Avoid making decisions after negative experiences",
        "Ignore media coverage when assessing risk",
      ],
      answer: 1,
    },
    {
      id: "q4",
      type: "mcq" as const,
      instruction: "Choose the correct letter, A, B, C or D.",
      text: "What does the organ donation example primarily illustrate?",
      options: [
        "Framing effects in medical decision making",
        "The anchoring effect in public policy",
        "The status quo bias and the power of default options",
        "How availability heuristics affect organ donation rates",
      ],
      answer: 2,
    },
    {
      id: "q5",
      type: "tfng" as const,
      instruction: "Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.",
      text: "Kahneman received the Nobel Prize specifically for his work on System 1 and System 2 thinking.",
      options: ["TRUE", "FALSE", "NOT GIVEN"],
      answer: 2, // NOT GIVEN
    },
    {
      id: "q6",
      type: "tfng" as const,
      instruction: "Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.",
      text: "People who are aware of cognitive biases are completely immune to their effects.",
      options: ["TRUE", "FALSE", "NOT GIVEN"],
      answer: 1, // FALSE
    },
    {
      id: "q7",
      type: "tfng" as const,
      instruction: "Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.",
      text: "Thaler and Sunstein use the term 'nudges' to describe environmental changes that guide better decisions.",
      options: ["TRUE", "FALSE", "NOT GIVEN"],
      answer: 0, // TRUE
    },
  ],
};

type View = "split" | "passage" | "questions";

// ─── Highlight logic ──────────────────────────────────────────────────────────

function HighlightableText({ text }: { text: string }) {
  const [highlights, setHighlights] = useState<{ start: number; end: number }[]>([]);

  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    // We can't easily map DOM selection to character offsets in a simple way here,
    // so just store the selected text visually (simplified)
    sel.removeAllRanges();
  }

  // Render paragraphs
  const paragraphs = text.split("\n\n").filter(Boolean);
  return (
    <div
      onMouseUp={handleMouseUp}
      className="passage-text select-text cursor-text"
    >
      {paragraphs.map((para, i) => (
        <p key={i} className="mb-4 last:mb-0">
          {para}
        </p>
      ))}
    </div>
  );
}

// ─── Question component ───────────────────────────────────────────────────────

function QuestionItem({
  q,
  index,
  userAnswer,
  onAnswer,
  showResult,
}: {
  q: TestQuestion;
  index: number;
  userAnswer: number | undefined;
  onAnswer: (idx: number) => void;
  showResult: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 pb-6 border-b border-[rgb(var(--border))] last:border-0 last:pb-0">
      {/* Instruction */}
      <p className="text-xs text-[rgb(var(--muted-foreground))] italic">{q.instruction}</p>

      {/* Question number + text */}
      <div className="flex gap-2">
        <span className="shrink-0 w-6 h-6 rounded-full bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--primary))] text-xs font-bold flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <p className="font-medium text-sm text-[rgb(var(--foreground))] leading-snug">
          {q.text}
        </p>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2 ml-8">
        {q.options.map((opt, i) => {
          const isSelected = userAnswer === i;
          const isCorrect = i === q.answer;
          let state: "default" | "selected" | "correct" | "wrong" = "default";
          if (showResult) {
            if (isCorrect) state = "correct";
            else if (isSelected) state = "wrong";
          } else if (isSelected) {
            state = "selected";
          }

          return (
            <button
              key={i}
              onClick={() => !showResult && onAnswer(i)}
              className={cn(
                "w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition-all flex items-center gap-2.5",
                state === "default" &&
                  "border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:border-[rgb(var(--primary)/0.4)] hover:bg-[rgb(var(--primary)/0.04)]",
                state === "selected" &&
                  "border-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.07)] font-medium",
                state === "correct" && "border-[rgb(var(--success))] bg-[rgb(var(--success)/0.07)]",
                state === "wrong" && "border-[rgb(var(--destructive))] bg-[rgb(var(--destructive)/0.07)]",
                showResult && "cursor-default"
              )}
            >
              {showResult ? (
                isCorrect ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[rgb(var(--success))] shrink-0" />
                ) : isSelected ? (
                  <XCircle className="w-3.5 h-3.5 text-[rgb(var(--destructive))] shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-[rgb(var(--border))] shrink-0" />
                )
              ) : (
                <span
                  className={cn(
                    "w-3.5 h-3.5 rounded-full border shrink-0 transition-colors",
                    isSelected
                      ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))]"
                      : "border-[rgb(var(--border))]"
                  )}
                />
              )}
              <span
                className={cn(
                  "text-[rgb(var(--foreground))]",
                  state === "correct" && "text-[rgb(var(--success))] font-medium",
                  state === "wrong" && "text-[rgb(var(--destructive))]",
                  state === "selected" && "text-[rgb(var(--primary))] font-medium"
                )}
              >
                {q.type === "mcq" ? (
                  <><span className="font-bold mr-1">{String.fromCharCode(65 + i)}.</span>{opt}</>
                ) : (
                  opt
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReadingTestPage() {
  const [test, setTest] = useState<ReadingTest>(FALLBACK_TEST);
  const [view, setView] = useState<View>("split");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(FALLBACK_TEST.timeLimit);
  const userIdRef = useRef<string | null>(null);

  // Load from Supabase on mount
  useEffect(() => {
    async function load() {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (user) userIdRef.current = user.id;
        const raw = user ? await getNextReading(sb, user.id) : null;
        if (raw) {
          const mapped = mapDbToTest(raw);
          if (mapped.questions.length > 0) {
            setTest(mapped);
            setTimeLeft(mapped.timeLimit);
          }
        }
      } catch { /* use fallback */ }
    }
    load();
  }, []);

  const totalQ = test.questions.length;
  const answered = Object.keys(answers).length;

  const score = submitted
    ? test.questions.filter((q) => answers[q.id] === q.answer).length
    : 0;
  const band = submitted
    ? score >= 7 ? 8.0 : score >= 6 ? 7.0 : score >= 5 ? 6.0 : score >= 4 ? 5.5 : score >= 3 ? 5.0 : 4.0
    : null;

  function handleAnswer(qId: string, optIdx: number) {
    setAnswers((prev) => ({ ...prev, [qId]: optIdx }));
  }

  async function handleSubmit() {
    setSubmitted(true);
    setView("questions");
    // Save attempt
    if (userIdRef.current && test.id !== "fallback") {
      try {
        const sb = createClient();
        const computedScore = test.questions.filter((q) => answers[q.id] === q.answer).length;
        const computedBand = computedScore >= 7 ? 8.0 : computedScore >= 6 ? 7.0 : computedScore >= 5 ? 6.0 : computedScore >= 4 ? 5.5 : computedScore >= 3 ? 5.0 : 4.0;
        await saveAttempt(sb, {
          user_id: userIdRef.current,
          content_type: "reading",
          content_id: test.id,
          answers,
          band_score: computedBand,
          raw_score: computedScore,
          total_questions: totalQ,
          time_spent: null,
          ai_feedback: null,
          completed_at: new Date().toISOString(),
        });
      } catch { /* non-fatal */ }
    }
  }

  // ── Results screen ──
  if (submitted && band !== null) {
    const bandColor =
      band >= 7
        ? "text-[rgb(var(--band-high))]"
        : band >= 5.5
        ? "text-[rgb(var(--band-mid))]"
        : "text-[rgb(var(--band-low))]";

    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
              <ChevronLeft className="w-4 h-4" />
              Dashboard
            </Link>
          </div>
        </div>

        <div className="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
          {/* Score card */}
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
            <Badge variant="default" className="mb-1">Тест завершён</Badge>
            <div className={cn("font-mono text-6xl font-bold", bandColor)}>
              {band}.0
            </div>
            <p className="text-[rgb(var(--muted-foreground))] text-sm">
              Верных ответов: <strong className="text-[rgb(var(--foreground))]">{score} из {totalQ}</strong>
            </p>
            <Progress
              value={(score / totalQ) * 100}
              className="w-full max-w-xs h-2"
              indicatorClassName={
                band >= 7 ? "bg-[rgb(var(--band-high))]"
                  : band >= 5.5 ? "bg-[rgb(var(--band-mid))]"
                  : "bg-[rgb(var(--band-low))]"
              }
            />
          </div>

          {/* AI Error analysis */}
          <ErrorAnalysis questions={test.questions} userAnswers={answers} />

          {/* Review questions */}
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
            <h2 className="font-semibold text-[rgb(var(--foreground))] mb-5">Разбор по вопросам</h2>
            <div className="flex flex-col gap-6">
              {test.questions.map((q, i) => (
                <QuestionItem
                  key={q.id}
                  q={q}
                  index={i}
                  userAnswer={answers[q.id]}
                  onAnswer={() => {}}
                  showResult={true}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/dashboard">На Dashboard</Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link href="/tests/reading">Следующий тест</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Test UI ──
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[rgb(var(--background))]">
      {/* ── Top bar ── */}
      <header className="shrink-0 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))] z-40">
        <div className="h-13 flex items-center gap-3 px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="text-sm font-medium text-[rgb(var(--foreground))] truncate">
                {test.title}
              </span>
              <Badge variant="outline" className="hidden sm:flex text-[10px]">{test.source}</Badge>
            </div>
          </div>

          {/* Progress */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="text-xs text-[rgb(var(--muted-foreground))]">
              {answered}/{totalQ}
            </span>
            <Progress value={(answered / totalQ) * 100} className="w-20 h-1.5" />
          </div>

          {/* Timer */}
          <div className="flex items-center gap-1.5 shrink-0 font-mono text-sm font-medium text-[rgb(var(--foreground))]">
            <Clock className="w-3.5 h-3.5 text-[rgb(var(--warning))]" />
            {formatTime(timeLeft)}
          </div>

          {/* View toggle — desktop */}
          <div className="hidden md:flex items-center gap-1 bg-[rgb(var(--surface-elevated))] p-0.5 rounded-lg shrink-0">
            {(["split", "passage", "questions"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs transition-all",
                  view === v
                    ? "bg-[rgb(var(--surface))] text-[rgb(var(--foreground))] shadow-sm font-medium"
                    : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                )}
              >
                {v === "split" ? "Разделить" : v === "passage" ? "Текст" : "Вопросы"}
              </button>
            ))}
          </div>

          {/* Submit */}
          <Button
            size="sm"
            className="shrink-0"
            disabled={answered < totalQ}
            onClick={handleSubmit}
          >
            <Flag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Сдать</span>
          </Button>
        </div>
        {/* Mobile view tabs */}
        <div className="md:hidden flex border-t border-[rgb(var(--border))]">
          <button
            onClick={() => setView("passage")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
              view === "passage"
                ? "text-[rgb(var(--primary))] border-b-2 border-[rgb(var(--primary))]"
                : "text-[rgb(var(--muted-foreground))]"
            )}
          >
            <AlignJustify className="w-3.5 h-3.5" />
            Текст
          </button>
          <button
            onClick={() => setView("questions")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
              view === "questions"
                ? "text-[rgb(var(--primary))] border-b-2 border-[rgb(var(--primary))]"
                : "text-[rgb(var(--muted-foreground))]"
            )}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Вопросы ({answered}/{totalQ})
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Passage panel */}
        {(view === "split" || view === "passage") && (
          <div
            className={cn(
              "overflow-y-auto p-5 md:p-6",
              view === "split" ? "flex-1 md:w-1/2 border-r border-[rgb(var(--border))]" : "flex-1"
            )}
          >
            <div className="max-w-prose mx-auto">
              <h2 className="text-lg font-semibold text-[rgb(var(--foreground))] mb-1">
                {test.title}
              </h2>
              <p className="text-xs text-[rgb(var(--muted-foreground))] mb-5">{test.source}</p>
              <HighlightableText text={test.passage} />
            </div>
          </div>
        )}

        {/* Questions panel */}
        {(view === "split" || view === "questions") && (
          <div
            className={cn(
              "overflow-y-auto p-5 md:p-6",
              view === "split" ? "flex-1 md:w-1/2" : "flex-1"
            )}
          >
            <div className="max-w-prose mx-auto flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-[rgb(var(--foreground))]">Questions 1–{totalQ}</h2>
                <span className="text-xs text-[rgb(var(--muted-foreground))]">
                  {answered} из {totalQ} отвечено
                </span>
              </div>

              {test.questions.map((q, i) => (
                <QuestionItem
                  key={q.id}
                  q={q}
                  index={i}
                  userAnswer={answers[q.id]}
                  onAnswer={(optIdx) => handleAnswer(q.id, optIdx)}
                  showResult={false}
                />
              ))}

              {/* Submit button (bottom of questions) */}
              <Button
                size="lg"
                className="w-full mt-2"
                disabled={answered < totalQ}
                onClick={handleSubmit}
              >
                <Flag className="w-4 h-4" />
                Сдать тест ({answered}/{totalQ} отвечено)
              </Button>
              {answered < totalQ && (
                <p className="text-xs text-center text-[rgb(var(--muted))]">
                  Ответьте на все вопросы перед сдачей
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
