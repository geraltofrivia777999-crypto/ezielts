"use client";

import { Suspense, useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  Eye,
  MessageCircle,
  Send,
  ArrowRight,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkDailyLimit, getNextReading, getReadingTest, incrementUsage, saveAttempt } from "@/lib/supabase/queries";
import { ErrorAnalysis } from "@/components/error-analysis";
import {
  mapDbToReadingTest,
  type ReadingTest,
  type ReadingPassage,
  type TestQuestion,
  READING_TIME_LIMIT_SEC,
  countReadingQuestions,
  gradableQuestions,
  isReadingAnswerCorrect,
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

type ReadingMode = "exam" | "practice";
type ReadingSession = { kind: "full" } | { kind: "passage"; partNumber: number };
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

function ReadingStartScreen({
  test,
  mode,
  onModeChange,
  onStartFull,
  onStartPassage,
}: {
  test: ReadingTest;
  mode: ReadingMode;
  onModeChange: (mode: ReadingMode) => void;
  onStartFull: () => void;
  onStartPassage: (partNumber: number) => void;
}) {
  const questionCount = countReadingQuestions(test);

  return (
    <div className="min-h-screen bg-[rgb(var(--background))]">
      <header className="bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] shrink-0">
            <ChevronLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium truncate">IELTS Reading</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-56px)] max-w-5xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <BookOpen className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-[rgb(var(--foreground))]">IELTS Reading</h1>
            <p className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">
              3 passages с вопросами на понимание академического текста
            </p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xl font-bold text-blue-600">60 мин</div>
              <div className="text-xs text-[rgb(var(--muted-foreground))]">Время</div>
            </div>
            <div>
              <div className="text-xl font-bold text-blue-600">{questionCount}</div>
              <div className="text-xs text-[rgb(var(--muted-foreground))]">Вопросов</div>
            </div>
            <div>
              <div className="text-xl font-bold text-blue-600">{test.passages.length}</div>
              <div className="text-xs text-[rgb(var(--muted-foreground))]">Passages</div>
            </div>
          </div>

          <div className="mt-7">
            <h2 className="text-sm font-semibold text-[rgb(var(--foreground))]">Формат теста</h2>
            <ul className="mt-3 space-y-2 text-sm text-[rgb(var(--muted-foreground))]">
              <li>• 3 passages: от более простого текста к сложному академическому</li>
              <li>• В Exam режиме работает таймер и авто-завершение</li>
              <li>• Типы вопросов: multiple choice, TRUE/FALSE/NOT GIVEN, matching, completion</li>
              <li>• Оценка: Band Score от 1 до 9</li>
            </ul>
          </div>

          <div className="mt-5 rounded-xl bg-[rgb(var(--surface-elevated))] px-3 py-2 text-xs text-[rgb(var(--muted-foreground))]">
            В Practice режиме можно спокойно тренировать отдельный passage
          </div>

          <div className="mt-6">
            <p className="mb-2 text-center text-xs font-medium text-[rgb(var(--foreground))]">Режим прохождения</p>
            <div className="grid grid-cols-2 gap-2">
              {(["exam", "practice"] as ReadingMode[]).map((item) => {
                const active = mode === item;
                const Icon = item === "exam" ? Clock : Target;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onModeChange(item)}
                    className={cn(
                      "rounded-xl border p-3 text-center transition-colors",
                      active
                        ? "border-blue-500 bg-blue-50"
                        : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:border-blue-300"
                    )}
                  >
                    <Icon className="mx-auto mb-2 h-4 w-4 text-blue-600" />
                    <div className="text-sm font-semibold text-[rgb(var(--foreground))]">
                      {item === "exam" ? "Exam" : "Practice"}
                    </div>
                    <div className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">
                      {item === "exam" ? "Таймер и band score" : "Без давления по времени"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Button size="lg" className="mt-5 w-full" onClick={onStartFull}>
            Начать тест Reading
            <ArrowRight className="h-4 w-4" />
          </Button>

          <div className="mt-4">
            <p className="mb-2 text-center text-xs text-[rgb(var(--muted-foreground))]">Или практикуйте отдельные passages</p>
            <div className="grid grid-cols-3 gap-2">
              {test.passages.map((passage) => (
                <button
                  key={passage.id}
                  type="button"
                  onClick={() => onStartPassage(passage.partNumber)}
                  className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-elevated))] px-3 py-2 text-sm font-medium text-[rgb(var(--foreground))] hover:border-blue-300 hover:bg-blue-50"
                >
                  Passage {passage.partNumber}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Question component ──────────────────────────────────────────────────────

function readingCorrectAnswer(q: TestQuestion): string {
  if (q.type === "text") return q.expectedText ?? "—";
  if (typeof q.answer === "number") {
    const label = q.type === "mcq" || q.type === "matching" ? `${String.fromCharCode(65 + q.answer)}. ` : "";
    return `${label}${q.options[q.answer] ?? "—"}`;
  }
  return "—";
}

function readingUserAnswer(q: TestQuestion, value: number | string | undefined): string {
  if (typeof value === "number") {
    const label = q.type === "mcq" || q.type === "matching" ? `${String.fromCharCode(65 + value)}. ` : "";
    return `${label}${q.options[value] ?? value}`;
  }
  return typeof value === "string" ? value : "";
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
  q: TestQuestion;
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
          className="inline-flex h-7 items-center gap-1 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 font-medium text-[rgb(var(--foreground))] hover:border-blue-300"
        >
          <Eye className="h-3.5 w-3.5" />
          Ответ
        </button>
        <button
          type="button"
          onClick={() => onAskAi()}
          disabled={aiState.loading}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 font-medium text-blue-600 hover:border-blue-400 disabled:opacity-60"
        >
          {aiState.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
          ИИ
        </button>
      </div>

      {revealed && (
        <div className="rounded-lg border border-[rgb(var(--success)/0.25)] bg-[rgb(var(--success)/0.07)] px-2.5 py-2 text-[rgb(var(--foreground))]">
          <span className="font-semibold text-[rgb(var(--success))]">Ответ {number}: </span>
          <span>{readingCorrectAnswer(q)}</span>
        </div>
      )}

      {aiState.open && (
        <div className="w-full min-w-72 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 text-left shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-[rgb(var(--foreground))]">
            <MessageCircle className="h-3.5 w-3.5 text-blue-600" />
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
                    ? "ml-6 bg-blue-50 text-[rgb(var(--foreground))]"
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
              className="min-w-0 flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 py-2 text-xs focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => aiState.draft.trim() && onAskAi(aiState.draft)}
              disabled={aiState.loading || !aiState.draft.trim()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white disabled:opacity-50"
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

function QuestionItem({
  q,
  globalIndex,
  userAnswer,
  onAnswer,
  showResult,
  revealed = false,
  aiState = emptyAiState(),
  onToggleAnswer,
  onAskAi,
  onAiDraftChange,
}: {
  q: TestQuestion;
  globalIndex: number;
  userAnswer: number | string | undefined;
  onAnswer: (idx: number | string) => void;
  showResult: boolean;
  revealed?: boolean;
  aiState?: QuestionAiState;
  onToggleAnswer?: () => void;
  onAskAi?: (message?: string) => void;
  onAiDraftChange?: (value: string) => void;
}) {
  if (q.type === "text") {
    const textValue = typeof userAnswer === "string" ? userAnswer : "";
    const correct = isReadingAnswerCorrect(q, userAnswer);
    return (
      <div className="flex flex-col gap-3 pb-6 border-b border-[rgb(var(--border))] last:border-0 last:pb-0">
        <p className="text-xs text-[rgb(var(--muted-foreground))] italic">{q.instruction}</p>
        <div className="flex gap-2">
          <span className="shrink-0 w-6 h-6 rounded-full bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--primary))] text-xs font-bold flex items-center justify-center mt-0.5">
            {globalIndex + 1}
          </span>
          <p className="font-medium text-sm text-[rgb(var(--foreground))] leading-snug">{q.text}</p>
        </div>
        <div className="ml-8 flex flex-col gap-2">
          <input
            value={textValue}
            disabled={showResult}
            onChange={(e) => onAnswer(e.target.value)}
            placeholder="Введите ответ"
            className={cn(
              "w-full px-3.5 py-2.5 rounded-xl border text-sm bg-[rgb(var(--surface))] outline-none transition-all",
              !showResult && "border-[rgb(var(--border))] focus:border-[rgb(var(--primary))]",
              showResult && correct && "border-[rgb(var(--success))] bg-[rgb(var(--success)/0.07)]",
              showResult && !correct && "border-[rgb(var(--destructive))] bg-[rgb(var(--destructive)/0.07)]"
            )}
          />
          {showResult && (
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              Правильный ответ: <span className="font-medium text-[rgb(var(--foreground))]">{q.expectedText}</span>
            </p>
          )}
        </div>
        {onToggleAnswer && onAskAi && onAiDraftChange && (
          <div className="ml-8">
            <QuestionSupportPanel
              q={q}
              number={globalIndex + 1}
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
              {q.type === "mcq" || q.type === "matching" ? (
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
      {onToggleAnswer && onAskAi && onAiDraftChange && (
        <div className="ml-8">
          <QuestionSupportPanel
            q={q}
            number={globalIndex + 1}
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

function ReadingTestPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTestId = searchParams.get("id");
  const [test, setTest] = useState<ReadingTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPart, setCurrentPart] = useState(1); // 1, 2 or 3
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(() => new Set());
  const [aiStates, setAiStates] = useState<Record<string, QuestionAiState>>({});
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState<ReadingSession | null>(null);
  const [mode, setMode] = useState<ReadingMode>("exam");
  const [timeLeft, setTimeLeft] = useState(READING_TIME_LIMIT_SEC);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
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

        const raw = selectedTestId
          ? await getReadingTest(sb, selectedTestId)
          : user ? await getNextReading(sb, user.id) : null;
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
  }, [selectedTestId]);

  // ── Derived data ──
  const activePassages = useMemo<ReadingPassage[]>(() => {
    if (!test || !session) return [];
    return session.kind === "passage"
      ? test.passages.filter((p) => p.partNumber === session.partNumber)
      : test.passages;
  }, [test, session]);

  const activeTest = useMemo<ReadingTest | null>(() => {
    if (!test || !session) return null;
    return { ...test, passages: activePassages };
  }, [test, session, activePassages]);

  const activeTimeLimit = session?.kind === "passage" ? 20 * 60 : READING_TIME_LIMIT_SEC;
  const totalQ = activeTest ? countReadingQuestions(activeTest) : 0;
  const answered = activeTest
    ? activeTest.passages
      .flatMap((p) => p.questions)
      .filter((q) => {
        const value = answers[q.id];
        return typeof value === "string" ? value.trim().length > 0 : value !== undefined;
      }).length
    : 0;

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
    if (!activeTest || !submitted) return 0;
    return gradableQuestions(activeTest).filter((q) => isReadingAnswerCorrect(q, answers[q.id])).length;
  }, [activeTest, submitted, answers]);

  const gradableCount = activeTest ? gradableQuestions(activeTest).length : 0;
  const band = submitted && gradableCount > 0 ? rawToBand(score, gradableCount) : null;

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!test || !activeTest) return;
    setSubmitted(true);
    if (userIdRef.current && test.id !== "fallback") {
      try {
        const sb = createClient();
        const allowed = await checkDailyLimit(sb, userIdRef.current, "reading");
        if (!allowed) {
          setLimitNotice("Бесплатный лимит на сегодня уже использован. Результат показан, но попытка не сохранена.");
          return;
        }
        const correct = gradableQuestions(activeTest).filter((q) => isReadingAnswerCorrect(q, answers[q.id])).length;
        const total = gradableQuestions(activeTest).length;
        await saveAttempt(sb, {
          user_id: userIdRef.current,
          content_type: "reading",
          content_id: test.id,
          answers,
          band_score: rawToBand(correct, total),
          raw_score: correct,
          total_questions: total,
          time_spent: mode === "exam" ? activeTimeLimit - timeLeft : 0,
          ai_feedback: null,
          completed_at: new Date().toISOString(),
        });
        await incrementUsage(sb, userIdRef.current, "reading");
      } catch { /* non-fatal */ }
    }
  }, [test, activeTest, answers, mode, activeTimeLimit, timeLeft]);

  // ── Countdown timer (real, with auto-submit at 0) ──
  useEffect(() => {
    if (loading || !session || mode !== "exam" || submitted || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [loading, session, mode, submitted, timeLeft]);

  // Separate effect: when the clock hits zero, schedule a submit on the next
  // tick. Deferring with setTimeout(0) avoids cascading renders inside the
  // effect (React rule: no setState calls during effect setup).
  useEffect(() => {
    if (loading || !session || mode !== "exam" || submitted || timeLeft !== 0) return;
    const id = setTimeout(() => { handleSubmit(); }, 0);
    return () => clearTimeout(id);
  }, [loading, session, mode, submitted, timeLeft, handleSubmit]);

  function handleAnswer(qId: string, value: number | string) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }

  async function startSession(nextSession: ReadingSession) {
    if (userIdRef.current && test?.id !== "fallback") {
      const sb = createClient();
      const allowed = await checkDailyLimit(sb, userIdRef.current, "reading");
      if (!allowed) {
        router.push("/pricing");
        return;
      }
    }
    setSession(nextSession);
    setCurrentPart(nextSession.kind === "passage" ? nextSession.partNumber : 1);
    setAnswers({});
    setRevealedAnswers(new Set());
    setAiStates({});
    setSubmitted(false);
    setLimitNotice(null);
    setTimeLeft(nextSession.kind === "passage" ? 20 * 60 : READING_TIME_LIMIT_SEC);
  }

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
    q: TestQuestion,
    number: number,
    passage: ReadingPassage,
    message?: string
  ) => {
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
      const res = await fetch("/api/ai/reading-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionNumber: number,
          questionText: q.text,
          instruction: q.instruction,
          options: q.options,
          correctAnswer: readingCorrectAnswer(q),
          userAnswer: readingUserAnswer(q, answers[q.id]),
          passageText: passage.passageText,
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
  }, [aiStates, answers]);

  // ── Render: loading ──
  if (loading || !test) return <ReadingSkeleton />;
  if (!session) {
    return (
      <ReadingStartScreen
        test={test}
        mode={mode}
        onModeChange={setMode}
        onStartFull={() => startSession({ kind: "full" })}
        onStartPassage={(partNumber) => startSession({ kind: "passage", partNumber })}
      />
    );
  }

  // Flatten all questions for the ErrorAnalysis component on results screen.
  // It accepts answer: number | null — we keep null for non-gradable to skip them.
  const allQuestionsForAnalysis = activePassages.flatMap((p) =>
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
  const numericAnswers: Record<string, number> = {};
  for (const [qid, value] of Object.entries(answers)) {
    if (typeof value === "number") numericAnswers[qid] = value;
  }

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
            {limitNotice && (
              <div className="mt-1 rounded-xl border border-[rgb(var(--warning)/0.25)] bg-[rgb(var(--warning)/0.08)] px-3 py-2 text-xs text-[rgb(var(--warning))]">
                {limitNotice}
              </div>
            )}
            <Progress
              value={(score / gradableCount) * 100}
              className="w-full max-w-xs h-2"
              indicatorClassName={
                band >= 7 ? "bg-[rgb(var(--band-high))]" : band >= 5.5 ? "bg-[rgb(var(--band-mid))]" : "bg-[rgb(var(--band-low))]"
              }
            />
          </div>

          {allQuestionsForAnalysis.length > 0 && (
            <ErrorAnalysis questions={allQuestionsForAnalysis} userAnswers={numericAnswers} />
          )}

          {/* Per-passage review */}
          {activePassages.map((p) => (
            <div key={p.id} className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6">
              <h2 className="font-semibold text-[rgb(var(--foreground))] mb-5">
                Passage {p.partNumber} — разбор
              </h2>
              <div className="flex flex-col gap-6">
                {p.questions.map((q) => (
                  <QuestionItem
                    key={q.id}
                    q={q as TestQuestion}
                    globalIndex={globalIndex.get(q.id) ?? 0}
                    userAnswer={answers[q.id]}
                    onAnswer={() => {}}
                    showResult={true}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/dashboard">На Dashboard</Link>
            </Button>
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

  // ── Render: active test ──
  const passage: ReadingPassage =
    activePassages.find((p) => p.partNumber === currentPart) ?? activePassages[0];
  const firstActivePart = Math.min(...activePassages.map((p) => p.partNumber));
  const lastActivePart = Math.max(...activePassages.map((p) => p.partNumber));
  const canSubmitReading = session.kind === "passage" || currentPart === lastActivePart;
  const lowTime = mode === "exam" && timeLeft < 5 * 60;

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
                {session.kind === "passage" ? `${test.title} · Passage ${session.partNumber}` : test.title}
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
            {mode === "exam" ? formatTime(timeLeft) : "Practice"}
          </div>

          {canSubmitReading && (
            <Button size="sm" className="shrink-0" onClick={handleSubmit}>
              <Flag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Сдать</span>
            </Button>
          )}
        </div>

        {/* Passage tabs (Part 1 / 2 / 3) */}
        <nav className="border-t border-[rgb(var(--border))] flex">
          {activePassages.map((p) => {
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

            {passage.questions.map((q) => (
                <QuestionItem
                  key={q.id}
                  q={q as TestQuestion}
                  globalIndex={globalIndex.get(q.id) ?? 0}
                  userAnswer={answers[q.id]}
                  onAnswer={(idx) => handleAnswer(q.id, idx)}
                  showResult={false}
                  revealed={revealedAnswers.has(q.id)}
                  aiState={aiStates[q.id] ?? emptyAiState()}
                  onToggleAnswer={() => toggleRevealedAnswer(q.id)}
                  onAskAi={(message) => askQuestionAi(q as TestQuestion, (globalIndex.get(q.id) ?? 0) + 1, passage, message)}
                  onAiDraftChange={(value) => updateAiDraft(q.id, value)}
                />
            ))}

            {/* Cross-passage navigation */}
            <div className="flex gap-2 pt-2">
              {session.kind === "full" && currentPart > firstActivePart && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCurrentPart(currentPart - 1)}
                >
                  ← Passage {currentPart - 1}
                </Button>
              )}
              {session.kind === "full" && currentPart < lastActivePart && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCurrentPart(currentPart + 1)}
                >
                  Passage {currentPart + 1} →
                </Button>
              )}
            </div>

            {canSubmitReading && (
              <>
                <Button size="lg" className="w-full" onClick={handleSubmit}>
                  <Flag className="w-4 h-4" />
                  Сдать тест ({answered}/{totalQ} отвечено)
                </Button>
                {mode === "exam" && answered < totalQ && (
                  <p className="text-xs text-center text-[rgb(var(--muted-foreground))]">
                    Сдать тест можно на последнем passage — таймер автоматически завершит тест на 0:00.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReadingTestPage() {
  return (
    <Suspense fallback={<ReadingSkeleton />}>
      <ReadingTestPageContent />
    </Suspense>
  );
}
