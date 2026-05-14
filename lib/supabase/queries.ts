/**
 * EZielts — typed Supabase query helpers
 * Use createClient() from ./server in Server Components / API routes.
 * Use createClient() from ./client in Client Components.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ContentType } from "./types";

type SB = SupabaseClient<Database>;

// ── User & Auth ───────────────────────────────────────────────────────────────

export async function getProfile(sb: SB, userId: string) {
  const { data } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data;
}

export async function getUserSummary(sb: SB, userId: string) {
  const { data } = await (sb as any)
    .from("v_user_summary")
    .select("*")
    .eq("id", userId)
    .single();
  return data as Database["public"]["Views"]["v_user_summary"]["Row"] | null;
}

export async function updateProfile(
  sb: SB,
  userId: string,
  updates: Database["public"]["Tables"]["profiles"]["Update"]
) {
  const { data, error } = await (sb as any)
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();
  return { data, error };
}

// ── Freemium limits ───────────────────────────────────────────────────────────

export async function checkDailyLimit(
  sb: SB,
  userId: string,
  contentType: ContentType | "ai_tutor"
): Promise<boolean> {
  const { data } = await (sb as any).rpc("check_daily_limit", {
    p_user_id: userId,
    p_content_type: contentType,
  });
  return Boolean(data);
}

export async function incrementUsage(
  sb: SB,
  userId: string,
  contentType: ContentType | "ai_tutor"
) {
  await (sb as any).rpc("increment_usage", {
    p_user_id: userId,
    p_content_type: contentType,
  });
}

// ── Content rotation ──────────────────────────────────────────────────────────

export async function getNextReading(sb: SB, userId: string) {
  const { data } = await (sb as any).rpc("get_next_reading", { p_user_id: userId });
  if (!data) return null;
  return getReadingTest(sb, data as string);
}

export async function getNextListening(sb: SB, userId: string) {
  const { data } = await (sb as any).rpc("get_next_listening", { p_user_id: userId });
  if (!data) return null;
  return getListeningTest(sb, data as string);
}

export async function getNextWriting(
  sb: SB,
  userId: string,
  taskType?: "task1" | "task2"
) {
  const { data } = await (sb as any).rpc("get_next_writing", {
    p_user_id: userId,
    p_task_type: taskType ?? null,
  });
  if (!data) return null;
  return getWritingTask(sb, data as string);
}

// ── Content fetchers ──────────────────────────────────────────────────────────

export async function getReadingTest(sb: SB, testId: string) {
  const { data: test } = await sb
    .from("reading_tests")
    .select("*")
    .eq("id", testId)
    .single();
  if (!test) return null;

  const { data: sections } = await (sb as any)
    .from("reading_sections")
    .select("*, reading_question_groups(*, reading_questions(*))")
    .eq("test_id", testId)
    .order("part_number");

  return { ...(test as object), sections: (sections ?? []) as any[] };
}

export async function getListeningTest(sb: SB, testId: string) {
  const { data: test } = await sb
    .from("listening_tests")
    .select("*")
    .eq("id", testId)
    .single();
  if (!test) return null;

  const { data: groups } = await (sb as any)
    .from("listening_question_groups")
    .select("*, listening_questions(*)")
    .eq("test_id", testId)
    .order("section_number", { ascending: true, nullsFirst: false })
    .order("sort_order");

  return { ...(test as object), question_groups: (groups ?? []) as any[] };
}

// Reading mock test (3 passages combined IELTS-style)
export async function getReadingMockTest(sb: SB, mockId: string) {
  const { data: mock } = await (sb as any)
    .from("reading_mock_tests")
    .select("*")
    .eq("id", mockId)
    .single();
  if (!mock) return null;

  const testIds = (mock.test_ids ?? []) as string[];
  const tests = await Promise.all(testIds.map((id) => getReadingTest(sb, id)));
  return {
    id: mock.id,
    title: mock.title,
    category: mock.category,
    passages: tests.filter(Boolean),
    total_questions: mock.total_questions,
  };
}

export async function getRandomReadingMock(sb: SB, category: "academic" | "general" = "academic") {
  const { data } = await (sb as any)
    .from("reading_mock_tests")
    .select("id")
    .eq("category", category)
    .limit(50);
  if (!data || data.length === 0) return null;
  const random = data[Math.floor(Math.random() * data.length)];
  return getReadingMockTest(sb, random.id);
}

export async function getWritingTask(sb: SB, taskId: string) {
  const { data } = await sb
    .from("writing_tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  return data;
}

export async function getSpeakingTopics(sb: SB, part: 1 | 2 | 3, limit = 10) {
  const { data } = await sb
    .from("speaking_topics")
    .select("*")
    .eq("part", part)
    .order("created_at")
    .limit(limit);
  return data ?? [];
}

// ── Attempts ──────────────────────────────────────────────────────────────────

export async function saveAttempt(
  sb: SB,
  attempt: Database["public"]["Tables"]["user_test_attempts"]["Insert"]
) {
  const { data, error } = await (sb as any)
    .from("user_test_attempts")
    .insert(attempt)
    .select()
    .single();
  return { data, error };
}

export async function getUserAttempts(
  sb: SB,
  userId: string,
  contentType?: ContentType,
  limit = 20
) {
  let query = (sb as any)
    .from("user_test_attempts")
    .select("*")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (contentType) {
    query = query.eq("content_type", contentType);
  }

  const { data } = await query;
  return (data ?? []) as Database["public"]["Tables"]["user_test_attempts"]["Row"][];
}

// ── Progress & Analytics ──────────────────────────────────────────────────────

export async function getBandHistory(sb: SB, userId: string) {
  const { data } = await (sb as any)
    .from("v_band_history")
    .select("*")
    .eq("user_id", userId)
    .order("attempt_date", { ascending: true });
  return (data ?? []) as Database["public"]["Views"]["v_band_history"]["Row"][];
}

export async function getStreak(sb: SB, userId: string): Promise<number> {
  const { data } = await (sb as any)
    .from("v_user_summary")
    .select("streak")
    .eq("id", userId)
    .single();
  return (data as any)?.streak ?? 0;
}

// ── Diagnostic ────────────────────────────────────────────────────────────────

export async function saveDiagnostic(
  sb: SB,
  result: Database["public"]["Tables"]["diagnostic_results"]["Insert"]
) {
  const { data, error } = await (sb as any)
    .from("diagnostic_results")
    .insert(result)
    .select()
    .single();
  return { data, error };
}

// ── AI Tutor ──────────────────────────────────────────────────────────────────

export async function getTutorMessages(sb: SB, userId: string, limit = 50) {
  const { data } = await sb
    .from("ai_tutor_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return data ?? [];
}

export async function saveTutorMessage(
  sb: SB,
  msg: Database["public"]["Tables"]["ai_tutor_messages"]["Insert"]
) {
  const { data, error } = await (sb as any)
    .from("ai_tutor_messages")
    .insert(msg)
    .select()
    .single();
  return { data, error };
}
