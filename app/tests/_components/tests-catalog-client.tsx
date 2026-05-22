"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Crown,
  Headphones,
  Loader2,
  Lock,
  Mic2,
  PenLine,
  Shuffle,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ContentType, Database } from "@/lib/supabase/types";

type Skill = ContentType;
type Attempt = Pick<
  Database["public"]["Tables"]["user_test_attempts"]["Row"],
  "content_type" | "content_id" | "band_score" | "raw_score" | "total_questions" | "completed_at"
>;

type CatalogItem = {
  id: string;
  type: Skill;
  title: string;
  subtitle: string;
  source: string;
  meta: string;
  official: boolean;
  href: string;
};

type Summary = {
  isPro: boolean;
  dailyUsed: number;
};

const SKILLS: Array<{
  key: Skill;
  label: string;
  shortLabel: string;
  icon: typeof BookOpen;
  tint: string;
}> = [
  { key: "reading", label: "Academic Reading", shortLabel: "Чтение", icon: BookOpen, tint: "text-blue-600 bg-blue-50" },
  { key: "listening", label: "Listening", shortLabel: "Аудир.", icon: Headphones, tint: "text-violet-600 bg-violet-50" },
  { key: "writing", label: "Writing", shortLabel: "Письмо", icon: PenLine, tint: "text-teal-600 bg-teal-50" },
  { key: "speaking", label: "Speaking", shortLabel: "Говор.", icon: Mic2, tint: "text-fuchsia-600 bg-fuchsia-50" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSource(source: string | null) {
  return (source || "IELTS").replace(/[_-]+/g, " ");
}

function isOfficial(source: string | null, title: string | null) {
  const haystack = `${source ?? ""} ${title ?? ""}`.toLowerCase();
  return haystack.includes("cambridge") || haystack.includes("ielts");
}

function countNestedQuestions(rows: unknown[], groupKey: string, questionKey: string) {
  return rows.reduce((sum, row) => {
    const groups = (row as Record<string, unknown>)[groupKey];
    if (!Array.isArray(groups)) return sum;
    return sum + groups.reduce((groupSum, group) => {
      const questions = (group as Record<string, unknown>)[questionKey];
      return groupSum + (Array.isArray(questions) ? questions.length : 0);
    }, 0);
  }, 0);
}

function bestAttempt(attempts: Attempt[], type: Skill, id: string) {
  const matches = attempts
    .filter((attempt) => attempt.content_type === type && attempt.content_id === id)
    .sort((a, b) => {
      const aTime = new Date(a.completed_at).getTime();
      const bTime = new Date(b.completed_at).getTime();
      return bTime - aTime;
    });
  return matches[0] ?? null;
}

function TestCard({
  item,
  attempt,
  locked,
}: {
  item: CatalogItem;
  attempt: Attempt | null;
  locked: boolean;
}) {
  const completed = Boolean(attempt);
  const scoreText =
    attempt?.band_score != null
      ? attempt.band_score.toFixed(1)
      : attempt?.raw_score != null && attempt.total_questions
        ? `${attempt.raw_score}/${attempt.total_questions}`
        : null;

  return (
    <div
      className={cn(
        "group rounded-xl border bg-[rgb(var(--surface))] p-4 shadow-sm transition-all",
        completed
          ? "border-[rgb(var(--success)/0.5)] ring-1 ring-[rgb(var(--success)/0.25)]"
          : "border-[rgb(var(--border))] hover:border-[rgb(var(--primary)/0.45)] hover:shadow-md",
        locked && !completed && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[rgb(var(--foreground))]">{item.title}</h3>
            {completed && <CheckCircle2 className="h-4 w-4 shrink-0 text-[rgb(var(--success))]" />}
          </div>
          <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">{item.subtitle}</p>
        </div>
        <Badge variant="outline" className="shrink-0 bg-white">
          {item.meta}
        </Badge>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {scoreText && (
            <Badge variant="success" className="font-mono">
              {scoreText}
            </Badge>
          )}
          <span className="truncate text-xs capitalize text-[rgb(var(--muted-foreground))]">
            {normalizeSource(item.source)}
          </span>
        </div>
        {locked ? (
          <Button size="sm" variant="outline" disabled>
            <Lock className="h-3.5 w-3.5" />
            Лимит
          </Button>
        ) : (
          <Button size="sm" asChild>
            <Link href={item.href}>{completed ? "Повторить" : "Начать"}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function TestsCatalogClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialSkill = (searchParams.get("skill") as Skill | null) ?? "reading";
  const [activeSkill, setActiveSkill] = useState<Skill>(
    SKILLS.some((skill) => skill.key === initialSkill) ? initialSkill : "reading"
  );
  const [officialOnly, setOfficialOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Record<Skill, CatalogItem[]>>({
    reading: [],
    listening: [],
    writing: [],
    speaking: [],
  });
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [summary, setSummary] = useState<Summary>({ isPro: false, dailyUsed: 0 });

  useEffect(() => {
    const skillFromUrl = searchParams.get("skill") as Skill | null;
    if (skillFromUrl && SKILLS.some((skill) => skill.key === skillFromUrl)) {
      setActiveSkill(skillFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        const today = todayIso();
        const [
          summaryRes,
          usageRes,
          attemptsRes,
          readingRes,
          listeningRes,
          writingRes,
          speakingRes,
        ] = await Promise.all([
          (sb as any).from("v_user_summary").select("is_pro, plan, subscription_status").eq("id", user.id).single(),
          (sb as any).from("user_daily_usage").select("reading_count, listening_count, writing_count, speaking_count").eq("user_id", user.id).eq("date", today).maybeSingle(),
          (sb as any)
            .from("user_test_attempts")
            .select("content_type, content_id, band_score, raw_score, total_questions, completed_at")
            .eq("user_id", user.id)
            .order("completed_at", { ascending: false })
            .limit(1000),
          (sb as any)
            .from("reading_tests")
            .select("id, title, source, category, difficulty, created_at, reading_sections(id, part_number, reading_question_groups(id, reading_questions(id)))")
            .order("created_at", { ascending: true })
            .limit(160),
          (sb as any)
            .from("listening_tests")
            .select("id, title, source, section, audio_duration, created_at, listening_question_groups(id, section_number, listening_questions(id))")
            .order("created_at", { ascending: true })
            .limit(160),
          (sb as any)
            .from("writing_tasks")
            .select("id, title:prompt_text, source, task_type, exam_type, min_words, created_at")
            .order("created_at", { ascending: true })
            .limit(160),
          (sb as any)
            .from("speaking_topics")
            .select("id, topic_text, source, part, created_at")
            .order("created_at", { ascending: true })
            .limit(160),
        ]);

        if (cancelled) return;

        const usage = usageRes.data ?? {};
        const dailyUsed =
          (usage.reading_count ?? 0) +
          (usage.listening_count ?? 0) +
          (usage.writing_count ?? 0) +
          (usage.speaking_count ?? 0);
        const summaryRow = summaryRes.data ?? {};
        const isPro = Boolean(summaryRow.is_pro)
          || (summaryRow.plan && summaryRow.plan !== "free" && summaryRow.subscription_status === "active");
        const loadedAttempts = (attemptsRes.data ?? []) as Attempt[];
        const readingRows = (readingRes.data ?? []) as Array<Record<string, any>>;
        const listeningRows = (listeningRes.data ?? []) as Array<Record<string, any>>;
        const writingRows = (writingRes.data ?? []) as Array<Record<string, any>>;
        const speakingRows = (speakingRes.data ?? []) as Array<Record<string, any>>;

        setSummary({ isPro, dailyUsed });
        setAttempts(loadedAttempts);
        setItems({
          reading: readingRows.map((row) => {
            const sections = Array.isArray(row.reading_sections) ? row.reading_sections : [];
            const qCount = countNestedQuestions(sections, "reading_question_groups", "reading_questions");
            return {
              id: row.id,
              type: "reading",
              title: row.title || "Academic Reading",
              subtitle: row.category || "Academic",
              source: row.source || "IELTS",
              meta: `${qCount || 40} вопр.`,
              official: isOfficial(row.source, row.title),
              href: `/tests/reading?id=${row.id}`,
            };
          }),
          listening: listeningRows.map((row) => {
            const groups = Array.isArray(row.listening_question_groups) ? row.listening_question_groups : [];
            const qCount = groups.reduce((sum, group) => {
              const questions = Array.isArray(group.listening_questions) ? group.listening_questions : [];
              return sum + questions.length;
            }, 0);
            const sections = new Set(groups.map((group) => group.section_number).filter(Boolean)).size || 4;
            return {
              id: row.id,
              type: "listening",
              title: row.title || "IELTS Listening",
              subtitle: `${sections} секции`,
              source: row.source || "IELTS",
              meta: `${qCount || 40} вопр.`,
              official: isOfficial(row.source, row.title),
              href: `/tests/listening?id=${row.id}`,
            };
          }),
          writing: writingRows.map((row) => {
            const title = String(row.title || "Writing task").replace(/\s+/g, " ").trim();
            return {
              id: row.id,
              type: "writing",
              title: title.length > 64 ? `${title.slice(0, 64)}...` : title,
              subtitle: `${String(row.task_type || "task").toUpperCase()} · ${row.exam_type || "Academic"}`,
              source: row.source || "IELTS",
              meta: `${row.min_words ?? 250}+ слов`,
              official: isOfficial(row.source, title),
              href: `/tests/writing?id=${row.id}`,
            };
          }),
          speaking: speakingRows.map((row) => {
            const title = String(row.topic_text || "Speaking topic").replace(/\s+/g, " ").trim();
            return {
              id: row.id,
              type: "speaking",
              title: title.length > 64 ? `${title.slice(0, 64)}...` : title,
              subtitle: `Part ${row.part || 1}`,
              source: row.source || "IELTS",
              meta: "устно",
              official: isOfficial(row.source, title),
              href: `/tests/speaking?part=${row.part || 1}&id=${row.id}`,
            };
          }),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [router]);

  const activeItems = useMemo(() => {
    const list = items[activeSkill] ?? [];
    return officialOnly ? list.filter((item) => item.official) : list;
  }, [activeSkill, items, officialOnly]);

  const completedCount = (items[activeSkill] ?? []).filter((item) => bestAttempt(attempts, item.type, item.id)).length;
  const freeLocked = !summary.isPro && summary.dailyUsed >= 1;
  const currentSkill = SKILLS.find((skill) => skill.key === activeSkill) ?? SKILLS[0];

  function startRandom() {
    if (freeLocked) return;
    const uncompleted = activeItems.filter((item) => !bestAttempt(attempts, item.type, item.id));
    const pool = uncompleted.length > 0 ? uncompleted : activeItems;
    if (pool.length === 0) return;
    const next = pool[Math.floor(Math.random() * pool.length)];
    router.push(next.href);
  }

  return (
    <AppShell title="Тесты">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--foreground))]">Пробные тесты IELTS</h1>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">Выберите тип теста и начните практику</p>
        </div>

        <div className="border-b border-[rgb(var(--border))]">
          <div className="flex gap-1 overflow-x-auto">
            {SKILLS.map((skill) => {
              const Icon = skill.icon;
              const active = activeSkill === skill.key;
              const count = items[skill.key]?.length ?? 0;
              return (
                <button
                  key={skill.key}
                  type="button"
                  onClick={() => setActiveSkill(skill.key)}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                    active
                      ? "border-[rgb(var(--primary))] text-[rgb(var(--primary))]"
                      : "border-transparent text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {skill.shortLabel}
                  <span className="rounded-full bg-[rgb(var(--surface-elevated))] px-2 py-0.5 text-xs">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {!summary.isPro && (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
              freeLocked
                ? "border-[rgb(var(--warning)/0.3)] bg-[rgb(var(--warning)/0.08)]"
                : "border-blue-100 bg-blue-50/70"
            )}
          >
            <div>
              <div className="font-semibold text-[rgb(var(--foreground))]">
                Free: 1 тест в день
              </div>
              <p className="text-sm text-[rgb(var(--muted-foreground))]">
                Сегодня использовано: {summary.dailyUsed}/1. У Pro все тесты открыты без дневного лимита.
              </p>
            </div>
            <Button asChild variant={freeLocked ? "default" : "outline"}>
              <Link href="/pricing">
                <Crown className="h-4 w-4" />
                Открыть Pro
              </Link>
            </Button>
          </div>
        )}

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", currentSkill.tint)}>
                  <currentSkill.icon className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-[rgb(var(--foreground))]">Тесты {currentSkill.label}</h2>
                  <p className="text-sm text-[rgb(var(--muted-foreground))]">
                    {activeItems.length} тестов · {completedCount} пройдено
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="inline-flex rounded-xl bg-[rgb(var(--surface-elevated))] p-1">
                <button
                  type="button"
                  onClick={() => setOfficialOnly(false)}
                  className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", !officialOnly ? "bg-white shadow-sm" : "text-[rgb(var(--muted-foreground))]")}
                >
                  Все
                </button>
                <button
                  type="button"
                  onClick={() => setOfficialOnly(true)}
                  className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", officialOnly ? "bg-white shadow-sm" : "text-[rgb(var(--muted-foreground))]")}
                >
                  Только официальные
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600">
                  <Shuffle className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-[rgb(var(--foreground))]">Случайный тест</div>
                  <p className="text-sm text-[rgb(var(--muted-foreground))]">
                    Сначала непройденные, потом давно пройденные
                  </p>
                </div>
              </div>
              <Button onClick={startRandom} disabled={loading || activeItems.length === 0 || freeLocked}>
                <Shuffle className="h-4 w-4" />
                Начать
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
              <Loader2 className="h-6 w-6 animate-spin text-[rgb(var(--primary))]" />
            </div>
          ) : activeItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 text-center text-sm text-[rgb(var(--muted-foreground))]">
              Для этого фильтра тестов пока нет.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {activeItems.map((item) => {
                const attempt = bestAttempt(attempts, item.type, item.id);
                return (
                  <TestCard
                    key={`${item.type}-${item.id}`}
                    item={item}
                    attempt={attempt}
                    locked={freeLocked}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
