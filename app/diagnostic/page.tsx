"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn, formatBand } from "@/lib/utils";
import {
  BookOpen,
  Brain,
  Clock,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { saveDiagnostic } from "@/lib/supabase/queries";

// ─── Diagnostic questions ────────────────────────────────────────────────────

const DIAGNOSTIC_QUESTIONS = [
  // Reading (6 questions)
  {
    id: "r1",
    skill: "reading" as const,
    passage:
      "The phenomenon of 'rewilding' — the large-scale restoration of ecosystems where nature is allowed to take care of itself — has gained considerable momentum in recent years. Unlike traditional conservation, which often focuses on maintaining landscapes in a particular state, rewilding allows natural processes to resume and aims to restore self-sustaining, biodiverse ecosystems.",
    question: "According to the passage, how does rewilding differ from traditional conservation?",
    options: [
      "Rewilding focuses on maintaining specific landscapes",
      "Rewilding allows natural processes to resume without intensive management",
      "Traditional conservation aims to restore biodiverse ecosystems",
      "Traditional conservation does not focus on ecosystems",
    ],
    answer: 1,
  },
  {
    id: "r2",
    skill: "reading" as const,
    passage:
      "Urban heat islands occur when cities experience higher temperatures than surrounding rural areas. This effect is primarily caused by the replacement of natural land cover with buildings, roads and other infrastructure that absorb and re-emit the sun's heat more than natural landscapes do.",
    question: "What is the PRIMARY cause of urban heat islands according to the passage?",
    options: [
      "Increased vehicle traffic in cities",
      "Industrial pollution from factories",
      "Replacement of natural land with heat-absorbing infrastructure",
      "Higher population density in urban areas",
    ],
    answer: 2,
  },
  {
    id: "r3",
    skill: "reading" as const,
    passage:
      "Despite significant advances in renewable energy technology, the transition away from fossil fuels remains slow. The International Energy Agency reports that coal, oil and natural gas still account for more than 80 percent of the world's primary energy supply, a figure that has barely changed over the past two decades.",
    question: "The passage suggests that the share of fossil fuels in global energy has:",
    options: [
      "Decreased dramatically in two decades",
      "Remained relatively unchanged despite new technology",
      "Increased due to growing energy demand",
      "Been replaced mostly by nuclear power",
    ],
    answer: 1,
  },
  {
    id: "r4",
    skill: "reading" as const,
    passage:
      "The concept of neuroplasticity — the brain's ability to reorganise itself by forming new neural connections throughout life — has transformed our understanding of human learning. Previously, scientists believed the brain's structure was largely fixed after childhood.",
    question: "What did scientists previously believe about the brain?",
    options: [
      "It could form unlimited neural connections",
      "Its structure was mostly fixed after childhood",
      "Neuroplasticity decreased with age",
      "Learning only occurred during early development",
    ],
    answer: 1,
  },
  {
    id: "r5",
    skill: "reading" as const,
    passage:
      "Microplastics — tiny plastic particles less than 5mm — have been found in virtually every environment on Earth, from the deepest ocean trenches to mountain peaks. Scientists are increasingly concerned about their potential effects on human health, though definitive evidence of harm remains limited.",
    question: "Which statement best reflects the current scientific view on microplastics?",
    options: [
      "Microplastics have been proven to cause serious human disease",
      "Microplastics are only found in marine environments",
      "Concern exists about health effects but definitive evidence is lacking",
      "Microplastics only affect animals, not humans",
    ],
    answer: 2,
  },
  {
    id: "r6",
    skill: "reading" as const,
    passage:
      "Remote work, once considered a fringe benefit, became mainstream during the pandemic. While many workers report higher productivity and better work-life balance, employers raise concerns about collaboration, company culture and the difficulty of mentoring junior staff remotely.",
    question: "According to the passage, what concern do employers have about remote work?",
    options: [
      "Workers are more productive when working remotely",
      "Remote work improves work-life balance too much",
      "Difficulties arise in collaboration and mentoring junior employees",
      "Remote work is too expensive for companies",
    ],
    answer: 2,
  },

  // Grammar/Vocabulary (5 questions)
  {
    id: "g1",
    skill: "grammar" as const,
    question:
      "Choose the correct sentence:",
    options: [
      "Despite of the rain, they continued the match.",
      "Despite the rain, they continued the match.",
      "Despite to the rain, they continued the match.",
      "Despite for the rain, they continued the match.",
    ],
    answer: 1,
  },
  {
    id: "g2",
    skill: "grammar" as const,
    question: "Select the word that best completes the sentence: 'The scientists were ___ by the unexpected results.'",
    options: ["astonished", "astonishing", "astonishment", "astonishingly"],
    answer: 0,
  },
  {
    id: "g3",
    skill: "grammar" as const,
    question: "Which sentence uses the passive voice CORRECTLY?",
    options: [
      "The report written by the team yesterday.",
      "The report was written by the team yesterday.",
      "The report has write by the team yesterday.",
      "The report were written by the team yesterday.",
    ],
    answer: 1,
  },
  {
    id: "g4",
    skill: "grammar" as const,
    question: "Choose the correct conditional: 'If she ___ harder, she would have passed the exam.'",
    options: ["studied", "had studied", "has studied", "would study"],
    answer: 1,
  },
  {
    id: "g5",
    skill: "grammar" as const,
    question: "Select the most academic synonym for 'show':",
    options: ["tell", "demonstrate", "say", "explain"],
    answer: 1,
  },
];

type Skill = "reading" | "grammar";

const SKILL_META: Record<Skill, { icon: typeof BookOpen; label: string; color: string; bg: string }> = {
  reading: { icon: BookOpen, label: "Reading", color: "text-blue-500", bg: "bg-blue-50" },
  grammar: { icon: Brain, label: "Grammar", color: "text-[rgb(var(--primary))]", bg: "bg-violet-50" },
};

const DIAGNOSTIC_SKILLS: Skill[] = ["reading", "grammar"];

type Phase = "intro" | "test" | "results";

// ─── Score → Band estimation ─────────────────────────────────────────────────

function estimateBand(correct: number, total: number, skill: Skill): number {
  const pct = correct / total;
  if (skill === "reading") {
    if (pct >= 0.9) return 8.0;
    if (pct >= 0.8) return 7.0;
    if (pct >= 0.67) return 6.0;
    if (pct >= 0.5) return 5.5;
    if (pct >= 0.33) return 5.0;
    return 4.0;
  }
  // Grammar as proxy
  if (pct >= 0.9) return 7.5;
  if (pct >= 0.7) return 6.5;
  if (pct >= 0.5) return 5.5;
  return 4.5;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DiagnosticPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const total = DIAGNOSTIC_QUESTIONS.length;
  const q = DIAGNOSTIC_QUESTIONS[currentIdx];
  const progress = ((currentIdx) / total) * 100;

  // ── Handlers ──
  function handleSelect(idx: number) {
    if (confirmed) return;
    setSelected(idx);
  }

  function handleConfirm() {
    if (selected === null) return;
    setAnswers((prev) => ({ ...prev, [q.id]: selected }));
    setConfirmed(true);
  }

  function handleNext() {
    setSelected(null);
    setConfirmed(false);
    if (currentIdx + 1 >= total) {
      setPhase("results");
    } else {
      setCurrentIdx((i) => i + 1);
    }
  }

  // ── Results calc ──
  const bySkill: Record<Skill, { correct: number; total: number }> = {
    reading: { correct: 0, total: 0 },
    grammar: { correct: 0, total: 0 },
  };
  DIAGNOSTIC_QUESTIONS.forEach((dq) => {
    const ans = answers[dq.id];
    bySkill[dq.skill].total++;
    if (ans === dq.answer) bySkill[dq.skill].correct++;
  });
  const bands: Record<Skill, number> = {
    reading: estimateBand(bySkill.reading.correct, bySkill.reading.total, "reading"),
    grammar: estimateBand(bySkill.grammar.correct, bySkill.grammar.total, "grammar"),
  };
  const overallBand = Math.round(((bands.reading + bands.grammar) / 2) * 2) / 2;

  // ── Save results to Supabase when results phase is reached ──
  useEffect(() => {
    if (phase !== "results") return;
    const weakSkills = DIAGNOSTIC_SKILLS
      .filter((s) => bands[s] < 6.0);

    async function persist() {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        await saveDiagnostic(sb, {
          user_id: user?.id ?? null,
          session_token: null,
          band_reading: bands.reading,
          band_listening: null,
          band_grammar: bands.grammar,
          overall_band: overallBand,
          weak_skills: weakSkills,
          answers,
        });
      } catch { /* non-fatal */ }
    }
    persist();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ─── INTRO ───────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-lg w-full text-center">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
              style={{ background: "rgb(var(--primary))" }}
            >
              <Brain className="w-8 h-8 text-white" />
            </div>
            <Badge variant="default" className="mb-4">Бесплатно · Без регистрации</Badge>
            <h1 className="text-3xl font-bold text-[rgb(var(--foreground))] mb-4">
              Диагностика уровня IELTS
            </h1>
            <p className="text-[rgb(var(--muted-foreground))] mb-8 leading-relaxed">
              {total} вопросов по Reading и Grammar. Займёт около{" "}
              <strong className="text-[rgb(var(--foreground))]">10 минут</strong>. По итогам
              получишь оценку band и персональные рекомендации.
            </p>

            <div className="flex flex-col gap-3 mb-8">
              {DIAGNOSTIC_SKILLS.map((skill) => {
                const { icon: Icon, label, color, bg } = SKILL_META[skill];
                const count = DIAGNOSTIC_QUESTIONS.filter((q) => q.skill === skill).length;
                return (
                  <div
                    key={skill}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl",
                      bg
                    )}
                  >
                    <Icon className={cn("w-5 h-5", color)} />
                    <span className="font-medium text-sm text-[rgb(var(--foreground))]">{label}</span>
                    <span className="ml-auto text-sm text-[rgb(var(--muted-foreground))]">
                      {count} вопросов
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-[rgb(var(--muted-foreground))] mb-6">
              <Clock className="w-4 h-4" />
              ~10 минут
            </div>

            <Button size="xl" className="w-full" onClick={() => setPhase("test")}>
              Начать диагностику
              <ChevronRight className="w-5 h-5" />
            </Button>
            <p className="text-xs text-[rgb(var(--muted))] mt-4">
              Регистрация не нужна — результаты покажем сразу
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULTS ─────────────────────────────────────────────────────────────
  if (phase === "results") {
    const weakSkills = (Object.entries(bands) as [Skill, number][])
      .filter(([, b]) => b < 6.0)
      .map(([s]) => SKILL_META[s].label);

    return (
      <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            {/* Overall band */}
            <div className="text-center mb-8">
              <div
                className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg"
                style={{
                  background:
                    overallBand >= 7
                      ? "rgb(var(--band-high))"
                      : overallBand >= 5
                      ? "rgb(var(--band-mid))"
                      : "rgb(var(--band-low))",
                }}
              >
                <span className="text-white font-mono font-bold text-3xl">
                  {formatBand(overallBand)}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-2">
                Твой расчётный уровень
              </h1>
              <p className="text-[rgb(var(--muted-foreground))] text-sm">
                На основе Reading и Grammar диагностики
              </p>
            </div>

            {/* Per-skill breakdown */}
            <div className="flex flex-col gap-4 mb-8">
              {(Object.entries(bands) as [Skill, number][]).map(([skill, band]) => {
                const { icon: Icon, label, color } = SKILL_META[skill];
                const { correct, total: t } = bySkill[skill];
                const bandColor =
                  band >= 7
                    ? "text-[rgb(var(--band-high))]"
                    : band >= 5.5
                    ? "text-[rgb(var(--band-mid))]"
                    : "text-[rgb(var(--band-low))]";
                return (
                  <div
                    key={skill}
                    className="bg-[rgb(var(--surface))] rounded-xl border border-[rgb(var(--border))] p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("w-4 h-4", color)} />
                        <span className="font-medium text-sm text-[rgb(var(--foreground))]">
                          {label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[rgb(var(--muted-foreground))]">
                          {correct}/{t} верно
                        </span>
                        <span className={cn("font-mono font-bold text-lg", bandColor)}>
                          {formatBand(band)}
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={(correct / t) * 100}
                      indicatorClassName={
                        band >= 7
                          ? "bg-[rgb(var(--band-high))]"
                          : band >= 5.5
                          ? "bg-[rgb(var(--band-mid))]"
                          : "bg-[rgb(var(--band-low))]"
                      }
                    />
                  </div>
                );
              })}
            </div>

            {/* Recommendation */}
            {weakSkills.length > 0 && (
              <div className="bg-[rgb(var(--primary)/0.07)] border border-[rgb(var(--primary)/0.2)] rounded-xl p-4 mb-6">
                <p className="text-sm text-[rgb(var(--foreground))] font-medium mb-1">
                  💡 Рекомендуем сосредоточиться на:
                </p>
                <p className="text-sm text-[rgb(var(--muted-foreground))]">
                  {weakSkills.join(", ")} — персональный план покажет конкретные упражнения.
                </p>
              </div>
            )}

            {/* CTA */}
            <div className="flex flex-col gap-3">
              <Button size="lg" className="w-full" asChild>
                <Link href="/signup">
                  Создать аккаунт и сохранить результаты
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full" asChild>
                <Link href="/login">Уже есть аккаунт — войти</Link>
              </Button>
            </div>
            <p className="text-xs text-center text-[rgb(var(--muted))] mt-4">
              Бесплатный план включает 1 тест в день
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── TEST ─────────────────────────────────────────────────────────────────
  const { icon: SkillIcon, label: skillLabel, color: skillColor, bg: skillBg } = SKILL_META[q.skill];

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col">
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[rgb(var(--surface))] border-b border-[rgb(var(--border))]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded bg-[rgb(var(--primary))] flex items-center justify-center">
              <span className="text-white font-bold text-xs">EZ</span>
            </div>
          </Link>

          {/* Progress */}
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <div className={cn("flex items-center gap-1.5 text-xs font-medium", skillColor)}>
                <SkillIcon className="w-3.5 h-3.5" />
                {skillLabel}
              </div>
              <span className="text-xs text-[rgb(var(--muted-foreground))]">
                {currentIdx + 1} / {total}
              </span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>
      </div>

      {/* Question content */}
      <div className="flex-1 pt-20 pb-8 px-4 max-w-2xl mx-auto w-full">
        {/* Skill badge */}
        <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-6", skillBg, skillColor)}>
          <SkillIcon className="w-3.5 h-3.5" />
          {skillLabel}
        </div>

        {/* Passage */}
        {q.skill === "reading" && "passage" in q && (
          <div className="passage-text bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl p-5 mb-6 text-[15px]">
            {q.passage}
          </div>
        )}

        {/* Question */}
        <p className="font-semibold text-[rgb(var(--foreground))] mb-5 leading-snug">
          {q.question}
        </p>

        {/* Options */}
        <div className="flex flex-col gap-3 mb-8">
          {q.options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrect = i === q.answer;
            let state: "default" | "selected" | "correct" | "wrong" = "default";
            if (confirmed) {
              if (isCorrect) state = "correct";
              else if (isSelected) state = "wrong";
            } else if (isSelected) {
              state = "selected";
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                className={cn(
                  "w-full text-left px-4 py-3.5 rounded-xl border text-sm transition-all duration-150",
                  "flex items-center gap-3",
                  state === "default" &&
                    "border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:border-[rgb(var(--primary)/0.4)] hover:bg-[rgb(var(--primary)/0.04)]",
                  state === "selected" &&
                    "border-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.08)] font-medium",
                  state === "correct" &&
                    "border-[rgb(var(--success))] bg-[rgb(var(--success)/0.08)]",
                  state === "wrong" &&
                    "border-[rgb(var(--destructive))] bg-[rgb(var(--destructive)/0.08)]"
                )}
              >
                {/* Circle or icon */}
                {confirmed ? (
                  isCorrect ? (
                    <CheckCircle2 className="w-4 h-4 text-[rgb(var(--success))] shrink-0" />
                  ) : isSelected ? (
                    <XCircle className="w-4 h-4 text-[rgb(var(--destructive))] shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-[rgb(var(--border))] shrink-0" />
                  )
                ) : (
                  <span
                    className={cn(
                      "w-4 h-4 rounded-full border shrink-0 transition-colors",
                      isSelected
                        ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))]"
                        : "border-[rgb(var(--border))]"
                    )}
                  />
                )}
                <span
                  className={cn(
                    state === "correct" && "text-[rgb(var(--success))] font-medium",
                    state === "wrong" && "text-[rgb(var(--destructive))]",
                    state === "selected" && "text-[rgb(var(--primary))]"
                  )}
                >
                  {opt}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action button */}
        {!confirmed ? (
          <Button
            size="lg"
            className="w-full"
            disabled={selected === null}
            onClick={handleConfirm}
          >
            Подтвердить ответ
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={handleNext}>
            {currentIdx + 1 < total ? "Следующий вопрос" : "Посмотреть результаты"}
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
