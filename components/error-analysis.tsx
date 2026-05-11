"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingDown, TrendingUp, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type AnalysisQuestion = {
  id: string;
  instruction?: string;
  text: string;
  options: string[];
  answer: number; // correct index
};

type Props = {
  questions: AnalysisQuestion[];
  userAnswers: Record<string, number>;
};

/** Categorize a question by its instruction into a "type". */
function categorize(instruction: string | undefined, text: string): string {
  const s = ((instruction ?? "") + " " + text).toLowerCase();
  if (/true|false|not given/.test(s)) return "True / False / Not Given";
  if (/headings|match.*heading/.test(s)) return "Matching Headings";
  if (/matching|match the/.test(s)) return "Matching";
  if (/yes|no|not given/.test(s)) return "Yes / No / Not Given";
  if (/summary|complete the summary/.test(s)) return "Summary Completion";
  if (/sentence completion|complete the sentence/.test(s)) return "Sentence Completion";
  if (/short answer|answer the question/.test(s)) return "Short Answer";
  if (/choose.*correct|select.*one|multiple choice|which/i.test(s)) return "Multiple Choice";
  if (/fill in|complete the|gap/.test(s)) return "Gap Fill";
  return "Other";
}

const RECOMMENDATIONS: Record<string, string> = {
  "True / False / Not Given":
    "Не путайте FALSE и NOT GIVEN. FALSE — текст прямо противоречит утверждению. NOT GIVEN — информации просто нет в тексте.",
  "Matching Headings":
    "Сначала прочитайте все заголовки, потом ищите главную мысль каждого абзаца (часто в первом или последнем предложении).",
  "Matching":
    "Подчёркивайте ключевые слова в каждом варианте, ищите перифразы (синонимы) в тексте, а не точные совпадения.",
  "Yes / No / Not Given":
    "Работайте с мнением автора, не с фактами. YES = автор согласен, NO = автор не согласен.",
  "Summary Completion":
    "Сначала прочитайте все варианты, определите часть речи в каждом пропуске, потом ищите в тексте.",
  "Sentence Completion":
    "Ограничение по словам (не более 2/3 слов) — критично. Считайте слова, иначе ответ не засчитают.",
  "Short Answer":
    "Ответ всегда буквально в тексте — не перефразируйте. Соблюдайте лимит слов.",
  "Multiple Choice":
    "Исключайте неверные варианты по одному. Не выбирайте по 'звучит знакомо' — ищите точное соответствие в тексте.",
  "Gap Fill":
    "Определите грамматическую форму нужного слова (часть речи, число, время) ДО поиска в тексте.",
  "Other":
    "Внимательно читайте инструкцию: каждый тип вопроса имеет свои правила.",
};

export function ErrorAnalysis({ questions, userAnswers }: Props) {
  // Group by category
  const stats = new Map<string, { total: number; correct: number; wrongIds: string[] }>();

  for (const q of questions) {
    const cat = categorize(q.instruction, q.text);
    const userAns = userAnswers[q.id];
    const isCorrect = userAns === q.answer;
    const s = stats.get(cat) ?? { total: 0, correct: 0, wrongIds: [] };
    s.total++;
    if (isCorrect) s.correct++;
    else s.wrongIds.push(q.id);
    stats.set(cat, s);
  }

  const rows = Array.from(stats.entries())
    .map(([cat, s]) => ({
      cat,
      total: s.total,
      correct: s.correct,
      accuracy: Math.round((s.correct / s.total) * 100),
      wrongIds: s.wrongIds,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const weakest = rows.filter((r) => r.accuracy < 70 && r.total >= 2);
  const strongest = rows.filter((r) => r.accuracy >= 80);

  const totalCorrect = rows.reduce((s, r) => s + r.correct, 0);
  const totalQ = rows.reduce((s, r) => s + r.total, 0);
  const overall = totalQ ? Math.round((totalCorrect / totalQ) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-6 flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[rgb(var(--primary))]" />
          <h2 className="font-semibold text-[rgb(var(--foreground))]">Анализ ошибок</h2>
          <span className="ml-auto text-sm text-[rgb(var(--muted-foreground))]">
            Точность: <strong className={cn(
              overall >= 70 ? "text-[rgb(var(--band-high))]"
                : overall >= 50 ? "text-[rgb(var(--band-mid))]"
                : "text-[rgb(var(--band-low))]"
            )}>{overall}%</strong>
          </span>
        </div>

        {/* Per-category breakdown */}
        <div className="flex flex-col gap-3">
          {rows.map((r) => {
            const color = r.accuracy >= 70
              ? "bg-[rgb(var(--band-high))]"
              : r.accuracy >= 50
                ? "bg-[rgb(var(--band-mid))]"
                : "bg-[rgb(var(--band-low))]";
            return (
              <div key={r.cat}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium text-[rgb(var(--foreground))]">{r.cat}</span>
                  <span className="text-xs text-[rgb(var(--muted-foreground))]">
                    {r.correct} / {r.total} · <strong>{r.accuracy}%</strong>
                  </span>
                </div>
                <Progress value={r.accuracy} indicatorClassName={color} className="h-2" />
              </div>
            );
          })}
        </div>

        {/* Weak areas + recommendations */}
        {weakest.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="font-medium text-[rgb(var(--foreground))] text-sm">Слабые места</span>
            </div>
            {weakest.map((w) => (
              <div key={w.cat} className="flex gap-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-[rgb(var(--foreground))]">{w.cat} <span className="text-[rgb(var(--muted-foreground))] font-normal">— {w.accuracy}%</span></div>
                  <p className="text-[rgb(var(--muted-foreground))] mt-0.5">{RECOMMENDATIONS[w.cat] ?? RECOMMENDATIONS["Other"]}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Strong areas */}
        {strongest.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {strongest.map((s) => (
              <div key={s.cat} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs">
                <TrendingUp className="w-3 h-3" />
                {s.cat} · {s.accuracy}%
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
