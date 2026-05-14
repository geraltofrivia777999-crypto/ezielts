"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatTime, rawToBand } from "@/lib/utils";
import {
  ChevronLeft,
  BookOpen,
  Clock,
  CheckCircle2,
  XCircle,
  Flag,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNextReading, saveAttempt } from "@/lib/supabase/queries";
import { ErrorAnalysis } from "@/components/error-analysis";
import {
  mapDbToReadingTest,
  type ReadingTest,
  type ReadingPassage,
  type TestQuestion,
  READING_TIME_LIMIT_SEC,
  countReadingQuestions,
  gradableQuestions,
} from "@/lib/test-mapping/reading";

// ─── Fallback test (used until the real test loads from Supabase) ────────────

const FALLBACK_TEST: ReadingTest = {
  id: "fallback",
  title: "Sample Academic Reading",
  source: "Cambridge IELTS 15",
  timeLimit: READING_TIME_LIMIT_SEC,
  passages: [
    {
      id: "p1",
      partNumber: 1,
      passageText:
        "The process by which humans make decisions has fascinated psychologists, economists, and neuroscientists for decades. Unlike the rational-actor model favoured by classical economists — which assumes that people consistently make choices that maximise their utility — research in behavioural economics has revealed that human decision-making is riddled with predictable irrationalities and cognitive biases.\n\nDaniel Kahneman, who won the Nobel Prize in Economics in 2002, proposed a dual-process theory of thought. System 1 thinking is fast, automatic and largely unconscious; it handles routine judgements and relies on heuristics. System 2 thinking, by contrast, is slow, deliberate and effortful; it is engaged when we face complex problems that require careful analysis.\n\nOne of the best-documented cognitive biases is the anchoring effect. When people are asked to make a numerical estimate, the first number they encounter — even if it is entirely arbitrary — exerts a powerful pull on their final judgement.",
      questions: [
        {
          id: "q1",
          type: "mcq",
          instruction: "Choose the correct letter, A, B, C or D.",
          text: "According to the passage, the rational-actor model assumes that people:",
          options: [
            "Make decisions based on emotions",
            "Always choose the option that maximises their benefit",
            "Are subject to predictable cognitive biases",
            "Use System 1 thinking for complex problems",
          ],
          answer: 1,
        },
        {
          id: "q2",
          type: "tfng",
          instruction:
            "Do the following statements agree with the information given? Write TRUE, FALSE or NOT GIVEN.",
          text: "System 1 thinking is engaged when people face complex analytical problems.",
          options: ["TRUE", "FALSE", "NOT GIVEN"],
          answer: 1,
        },
      ],
    },
    {
      id: "p2",
      partNumber: 2,
      passageText:
        "Urban planning has shifted dramatically over the past century. Where mid-twentieth-century cities prioritised the automobile, contemporary planners increasingly design for pedestrians, cyclists, and mixed-use neighbourhoods. The Dutch city of Houten is often cited as a pioneering example: its residential streets are organised around bicycle access, while cars are routed via a ring road.\n\nResearch suggests that walkable neighbourhoods correlate with higher physical activity levels and improved mental health among residents, though the direction of causality is debated.",
      questions: [
        {
          id: "q3",
          type: "tfng",
          instruction:
            "Do the following statements agree with the information given? Write TRUE, FALSE or NOT GIVEN.",
          text: "Mid-twentieth-century urban planning emphasised pedestrian access.",
          options: ["TRUE", "FALSE", "NOT GIVEN"],
          answer: 1,
        },
        {
          id: "q4",
          type: "mcq",
          instruction: "Choose the correct letter, A, B, C or D.",
          text: "Houten is cited as an example because:",
          options: [
            "It is the largest city in the Netherlands",
            "Its streets are organised around bicycle access",
            "It has banned cars entirely",
            "It pioneered electric vehicles",
          ],
          answer: 1,
        },
      ],
    },
    {
      id: "p3",
      partNumber: 3,
      passageText:
        "The development of mRNA vaccine technology represents one of the most significant biomedical breakthroughs of the early 21st century. Although mRNA-based therapeutic concepts were proposed as early as the 1990s, technical obstacles — particularly the instability of mRNA molecules in the body — long delayed their practical application.\n\nThe 2020 deployment of mRNA vaccines against SARS-CoV-2 demonstrated that the technology could be developed at unprecedented speed once the necessary platforms were in place.",
      questions: [
        {
          id: "q5",
          type: "mcq",
          instruction: "Choose the correct letter, A, B, C or D.",
          text: "According to the passage, why did mRNA therapeutics take so long to reach practical application?",
          options: [
            "Lack of scientific interest",
            "Insufficient regulatory frameworks",
            "Instability of mRNA molecules in the body",
            "Cost of clinical trials",
          ],
          answer: 2,
        },
      ],
    },
  ],
};

// ─── Loading skeleton ────────────────────────────────────────────────────────

function ReadingSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-[rgb(var(--background))]">
      <header className="h-14 border-b border-[rgb(var(--border))] flex items-center px-4 gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-[rgb(var(--muted-foreground))]" />
        <span className="text-sm text-[rgb(var(--muted-foreground))]">Загрузка теста…</span>
      </header>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 bg-[rgb(var(--surface-elevated))] rounded animate-pulse" style={{ width: `${60 + (i % 4) * 10}%` }} />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-[rgb(var(--surface-elevated))] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Question component ──────────────────────────────────────────────────────

function QuestionItem({
  q,
  globalIndex,
  userAnswer,
  onAnswer,
  showResult,
}: {
  q: TestQuestion;
  globalIndex: number;
  userAnswer: number | undefined;
  onAnswer: (idx: number) => void;
  showResult: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 pb-6 border-b border-[rgb(var(--border))] last:border-0 last:pb-0">
      <p className="text-xs text-[rgb(var(--muted-foreground))] italic">{q.instruction}</p>

      <div className="flex gap-2">
        <span className="shrink-0 w-6 h-6 rounded-full bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--primary))] text-xs font-bold flex items-center justify-center mt-0.5">
          {globalIndex + 1}
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
                state === "correct" &&
                  "border-[rgb(var(--success))] bg-[rgb(var(--success)/0.07)]",
                state === "wrong" &&
                  "border-[rgb(var(--destructive))] bg-[rgb(var(--destructive)/0.07)]",
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
                  <>
                    <span className="font-bold mr-1">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </>
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

// ─── Passage renderer (no broken selection logic, just paragraphs) ──────────

function PassageText({ text }: { text: string }) {
  const paragraphs = useMemo(() => text.split("\n\n").filter(Boolean), [text]);
  return (
    <div className="passage-text select-text leading-relaxed text-[15px] text-[rgb(var(--foreground))]">
      {paragraphs.map((p, i) => (
        <p key={i} className="mb-4 last:mb-0">{p}</p>
      ))}
    </div>
  );
}

// ─── Reading Test page ──────────────────────────────────────────────────────

export default function ReadingTestPage() {
  const [test, setTest] = useState<ReadingTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPart, setCurrentPart] = useState(1); // 1, 2 or 3
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(READING_TIME_LIMIT_SEC);
  const userIdRef = useRef<string | null>(null);

  // ── Load test ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (cancelled) return;
        if (user) userIdRef.current = user.id;

        const raw = user ? await getNextReading(sb, user.id) : null;
        if (cancelled) return;

        if (raw) {
          const mapped = mapDbToReadingTest(raw);
          if (mapped.passages.length > 0 && countReadingQuestions(mapped) > 0) {
            setTest(mapped);
            setTimeLeft(mapped.timeLimit);
            setLoading(false);
            return;
          }
        }
        // No DB content available → fallback
        setTest(FALLBACK_TEST);
        setTimeLeft(FALLBACK_TEST.timeLimit);
      } catch {
        if (!cancelled) setTest(FALLBACK_TEST);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Derived data ──
  const totalQ = test ? countReadingQuestions(test) : 0;
  const answered = Object.keys(answers).length;

  // Build a global numbering map so question N keeps its number across passages
  const globalIndex = useMemo(() => {
    const m = new Map<string, number>();
    if (!test) return m;
    let i = 0;
    for (const p of test.passages) {
      for (const q of p.questions) m.set(q.id, i++);
    }
    return m;
  }, [test]);

  const score = useMemo(() => {
    if (!test || !submitted) return 0;
    return gradableQuestions(test).filter((q) => answers[q.id] === q.answer).length;
  }, [test, submitted, answers]);

  const gradableCount = test ? gradableQuestions(test).length : 0;
  const band = submitted && gradableCount > 0 ? rawToBand(score, gradableCount) : null;

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!test) return;
    setSubmitted(true);
    if (userIdRef.current && test.id !== "fallback") {
      try {
        const sb = createClient();
        const correct = gradableQuestions(test).filter((q) => answers[q.id] === q.answer).length;
        const total = gradableQuestions(test).length;
        await saveAttempt(sb, {
          user_id: userIdRef.current,
          content_type: "reading",
          content_id: test.id,
          answers,
          band_score: rawToBand(correct, total),
          raw_score: correct,
          total_questions: total,
          time_spent: READING_TIME_LIMIT_SEC - timeLeft,
          ai_feedback: null,
          completed_at: new Date().toISOString(),
        });
      } catch { /* non-fatal */ }
    }
  }, [test, answers, timeLeft]);

  // ── Countdown timer (real, with auto-submit at 0) ──
  useEffect(() => {
    if (loading || submitted || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [loading, submitted, timeLeft]);

  // Separate effect: when the clock hits zero, schedule a submit on the next
  // tick. Deferring with setTimeout(0) avoids cascading renders inside the
  // effect (React rule: no setState calls during effect setup).
  useEffect(() => {
    if (loading || submitted || timeLeft !== 0) return;
    const id = setTimeout(() => { handleSubmit(); }, 0);
    return () => clearTimeout(id);
  }, [loading, submitted, timeLeft, handleSubmit]);

  function handleAnswer(qId: string, optIdx: number) {
    setAnswers((prev) => ({ ...prev, [qId]: optIdx }));
  }

  // ── Render: loading ──
  if (loading || !test) return <ReadingSkeleton />;

  // Flatten all questions for the ErrorAnalysis component on results screen.
  // It accepts answer: number | null — we keep null for non-gradable to skip them.
  const allQuestionsForAnalysis = test.passages.flatMap((p) =>
    p.questions
      .filter((q): q is TestQuestion & { answer: number } => q.answer !== null)
      .map((q) => ({
        id: q.id,
        instruction: q.instruction,
        text: q.text,
        options: q.options,
        answer: q.answer,
      }))
  );

  // ── Render: results ──
  if (submitted && band !== null) {
    const bandTextColor =
      band >= 7 ? "text-[rgb(var(--band-high))]" : band >= 5.5 ? "text-[rgb(var(--band-mid))]" : "text-[rgb(var(--band-low))]";
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col">
        <div className="sticky top-0 z-40 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
              <ChevronLeft className="w-4 h-4" />
              Dashboard
            </Link>
          </div>
        </div>

        <div className="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
            <Badge variant="default" className="mb-1">Тест завершён</Badge>
            <div className={cn("font-mono text-6xl font-bold", bandTextColor)}>{band.toFixed(1)}</div>
            <p className="text-[rgb(var(--muted-foreground))] text-sm">
              Верных ответов: <strong className="text-[rgb(var(--foreground))]">{score} из {gradableCount}</strong>
            </p>
            <Progress
              value={(score / gradableCount) * 100}
              className="w-full max-w-xs h-2"
              indicatorClassName={
                band >= 7 ? "bg-[rgb(var(--band-high))]" : band >= 5.5 ? "bg-[rgb(var(--band-mid))]" : "bg-[rgb(var(--band-low))]"
              }
            />
          </div>

          {allQuestionsForAnalysis.length > 0 && (
            <ErrorAnalysis questions={allQuestionsForAnalysis} userAnswers={answers} />
          )}

          {/* Per-passage review */}
          {test.passages.map((p) => (
            <div key={p.id} className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
              <h2 className="font-semibold text-[rgb(var(--foreground))] mb-5">
                Passage {p.partNumber} — разбор
              </h2>
              <div className="flex flex-col gap-6">
                {p.questions.map((q) => {
                  if (q.answer === null) return null; // non-gradable
                  return (
                    <QuestionItem
                      key={q.id}
                      q={q as TestQuestion}
                      globalIndex={globalIndex.get(q.id) ?? 0}
                      userAnswer={answers[q.id]}
                      onAnswer={() => {}}
                      showResult={true}
                    />
                  );
                })}
              </div>
            </div>
          ))}

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

  // ── Render: active test ──
  const passage: ReadingPassage =
    test.passages.find((p) => p.partNumber === currentPart) ?? test.passages[0];
  const lowTime = timeLeft < 5 * 60;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[rgb(var(--background))]">
      {/* Top bar */}
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
              {test.source && (
                <Badge variant="outline" className="hidden sm:flex text-[10px]">{test.source}</Badge>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="text-xs text-[rgb(var(--muted-foreground))]">{answered}/{totalQ}</span>
            <Progress value={(answered / totalQ) * 100} className="w-20 h-1.5" />
          </div>

          {/* Real countdown timer */}
          <div
            className={cn(
              "flex items-center gap-1.5 shrink-0 font-mono text-sm font-medium",
              lowTime
                ? "text-[rgb(var(--destructive))]"
                : "text-[rgb(var(--foreground))]"
            )}
          >
            <Clock className={cn("w-3.5 h-3.5", lowTime ? "text-[rgb(var(--destructive))]" : "text-[rgb(var(--warning))]")} />
            {formatTime(timeLeft)}
          </div>

          <Button size="sm" className="shrink-0" onClick={handleSubmit}>
            <Flag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Сдать</span>
          </Button>
        </div>

        {/* Passage tabs (Part 1 / 2 / 3) */}
        <nav className="border-t border-[rgb(var(--border))] flex">
          {test.passages.map((p) => {
            const partAnswered = p.questions.filter((q) => answers[q.id] !== undefined).length;
            const isActive = p.partNumber === currentPart;
            return (
              <button
                key={p.id}
                onClick={() => setCurrentPart(p.partNumber)}
                className={cn(
                  "flex-1 px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-2",
                  isActive
                    ? "border-[rgb(var(--primary))] text-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.04)]"
                    : "border-transparent text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                )}
              >
                <span>Passage {p.partNumber}</span>
                <span
                  className={cn(
                    "text-[10px] rounded-full px-1.5 py-0.5",
                    partAnswered === p.questions.length && p.questions.length > 0
                      ? "bg-[rgb(var(--success)/0.15)] text-[rgb(var(--success))]"
                      : "bg-[rgb(var(--surface-elevated))]"
                  )}
                >
                  {partAnswered}/{p.questions.length}
                </span>
              </button>
            );
          })}
        </nav>

        {lowTime && (
          <div className="bg-[rgb(var(--destructive)/0.08)] border-t border-[rgb(var(--destructive)/0.2)] px-4 py-1.5 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[rgb(var(--destructive))]" />
            <span className="text-xs text-[rgb(var(--destructive))]">
              Осталось меньше 5 минут — тест автоматически завершится по истечении времени.
            </span>
          </div>
        )}
      </header>

      {/* Body: passage left, its questions right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Passage panel */}
        <div className="flex-1 md:w-1/2 overflow-y-auto p-5 md:p-6 border-r border-[rgb(var(--border))] hidden md:block">
          <div className="max-w-prose mx-auto">
            <h2 className="text-lg font-semibold text-[rgb(var(--foreground))] mb-1">
              Passage {passage.partNumber}
            </h2>
            <p className="text-xs text-[rgb(var(--muted-foreground))] mb-5">
              Questions {(globalIndex.get(passage.questions[0]?.id ?? "") ?? 0) + 1}
              –{(globalIndex.get(passage.questions[passage.questions.length - 1]?.id ?? "") ?? 0) + 1}
            </p>
            <PassageText text={passage.passageText} />
          </div>
        </div>

        {/* Questions panel */}
        <div className="flex-1 md:w-1/2 overflow-y-auto p-5 md:p-6">
          <div className="max-w-prose mx-auto flex flex-col gap-6">
            {/* Mobile passage text appears above questions */}
            <details className="md:hidden bg-[rgb(var(--surface-elevated))] rounded-xl p-4">
              <summary className="text-sm font-medium cursor-pointer">
                Показать Passage {passage.partNumber}
              </summary>
              <div className="mt-3"><PassageText text={passage.passageText} /></div>
            </details>

            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[rgb(var(--foreground))]">
                Questions in Passage {passage.partNumber}
              </h2>
              <span className="text-xs text-[rgb(var(--muted-foreground))]">
                {passage.questions.filter((q) => answers[q.id] !== undefined).length} из{" "}
                {passage.questions.length} отвечено
              </span>
            </div>

            {passage.questions.map((q) => {
              // Free-text questions (answer === null) cannot be auto-graded in v1.
              // Show them but with a clear notice instead of fake options.
              if (q.answer === null) {
                return (
                  <div
                    key={q.id}
                    className="flex flex-col gap-2 pb-6 border-b border-[rgb(var(--border))] last:border-0 last:pb-0"
                  >
                    <p className="text-xs text-[rgb(var(--muted-foreground))] italic">{q.instruction}</p>
                    <div className="flex gap-2">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--primary))] text-xs font-bold flex items-center justify-center mt-0.5">
                        {(globalIndex.get(q.id) ?? 0) + 1}
                      </span>
                      <p className="font-medium text-sm text-[rgb(var(--foreground))] leading-snug">{q.text}</p>
                    </div>
                    <div className="ml-8 text-xs text-[rgb(var(--muted-foreground))] italic">
                      Этот тип вопроса (free-text) пока недоступен для авто-проверки. Он будет добавлен в следующей версии.
                    </div>
                  </div>
                );
              }
              return (
                <QuestionItem
                  key={q.id}
                  q={q as TestQuestion}
                  globalIndex={globalIndex.get(q.id) ?? 0}
                  userAnswer={answers[q.id]}
                  onAnswer={(idx) => handleAnswer(q.id, idx)}
                  showResult={false}
                />
              );
            })}

            {/* Cross-passage navigation */}
            <div className="flex gap-2 pt-2">
              {currentPart > 1 && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCurrentPart(currentPart - 1)}
                >
                  ← Passage {currentPart - 1}
                </Button>
              )}
              {currentPart < test.passages.length && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCurrentPart(currentPart + 1)}
                >
                  Passage {currentPart + 1} →
                </Button>
              )}
            </div>

            <Button size="lg" className="w-full" onClick={handleSubmit}>
              <Flag className="w-4 h-4" />
              Сдать тест ({answered}/{totalQ} отвечено)
            </Button>
            {answered < totalQ && (
              <p className="text-xs text-center text-[rgb(var(--muted-foreground))]">
                Можно сдать в любой момент — таймер автоматически завершит тест на 0:00.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
