/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server";
import type { ContentType, ExamType, Plan, SubStatus } from "@/lib/supabase/types";

type AuthUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
  user_metadata?: Record<string, unknown>;
};

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  target_band: number | null;
  exam_type: ExamType | null;
  goal: string | null;
  exam_date: string | null;
  current_band: number | null;
  band_reading: number | null;
  band_listening: number | null;
  band_writing: number | null;
  band_speaking: number | null;
  is_admin: boolean | null;
  created_at: string;
  updated_at: string | null;
};

type SubscriptionRow = {
  user_id: string;
  plan: Plan;
  status: SubStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

type AttemptRow = {
  user_id: string;
  content_type: ContentType;
  band_score: number | null;
  raw_score: number | null;
  total_questions: number | null;
  completed_at: string;
};

type DiagnosticRow = {
  user_id: string | null;
  band_reading: number | null;
  band_grammar: number | null;
  overall_band: number | null;
  created_at: string;
};

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string | null;
  profileCreatedAt: string | null;
  profileUpdatedAt: string | null;
  lastSignInAt: string | null;
  hasProfile: boolean;
  isAdmin: boolean;
  targetBand: number | null;
  currentBand: number | null;
  examType: ExamType | null;
  goal: string | null;
  examDate: string | null;
  bands: Record<ContentType, number | null>;
  lastBands: Record<ContentType, number | null>;
  subscription: SubscriptionRow | null;
  attemptsCount: number;
  lastActivityAt: string | null;
  diagnostic: DiagnosticRow | null;
};

export type AdminUsersData = {
  users: AdminUserRow[];
  generatedAt: string;
  totalAuthUsers: number;
  totalProfiles: number;
  totalPaidUsers: number;
  totalAttempts: number;
  totalDiagnostics: number;
  missingProfiles: number;
};

export type AdminContentCounts = {
  readingTests: number;
  listeningTests: number;
  writingTasks: number;
  speakingTopics: number;
};

const MAX_AUTH_PAGES = 20;
const AUTH_USERS_PER_PAGE = 1000;

async function listAllAuthUsers() {
  const service = createServiceClient();
  const users: AuthUser[] = [];

  for (let page = 1; page <= MAX_AUTH_PAGES; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PER_PAGE,
    });

    if (error) throw error;

    const pageUsers = (data?.users ?? []) as AuthUser[];
    users.push(...pageUsers);

    if (pageUsers.length < AUTH_USERS_PER_PAGE) break;
  }

  return users;
}

function newestByUser<T extends { user_id: string; updated_at?: string | null; created_at?: string | null; completed_at?: string | null }>(
  rows: T[],
  dateKey: keyof T
) {
  const map = new Map<string, T>();

  for (const row of rows) {
    const current = map.get(row.user_id);
    const nextDate = String(row[dateKey] ?? "");
    const currentDate = current ? String(current[dateKey] ?? "") : "";
    if (!current || nextDate > currentDate) {
      map.set(row.user_id, row);
    }
  }

  return map;
}

function metadataString(user: AuthUser, key: string) {
  const value = user.user_metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dateMax(values: Array<string | null | undefined>) {
  const sorted = values.filter(Boolean).sort();
  return sorted.at(-1) ?? null;
}

export async function getAdminUsersData(): Promise<AdminUsersData> {
  const service = createServiceClient();
  const authUsers = await listAllAuthUsers();
  const ids = authUsers.map((user) => user.id);

  const emptyFilter = ids.length === 0;
  const [
    profilesResult,
    subscriptionsResult,
    attemptsResult,
    diagnosticsResult,
    totalAttemptsResult,
    totalDiagnosticsResult,
  ] = await Promise.all([
    emptyFilter
      ? Promise.resolve({ data: [] })
      : (service as any)
          .from("profiles")
          .select(
            "id, name, email, phone, target_band, exam_type, goal, exam_date, current_band, band_reading, band_listening, band_writing, band_speaking, is_admin, created_at, updated_at"
          )
          .in("id", ids),
    emptyFilter
      ? Promise.resolve({ data: [] })
      : (service as any)
          .from("subscriptions")
          .select("user_id, plan, status, trial_ends_at, current_period_end, cancelled_at, created_at, updated_at")
          .in("user_id", ids)
          .order("updated_at", { ascending: false }),
    emptyFilter
      ? Promise.resolve({ data: [] })
      : (service as any)
          .from("user_test_attempts")
          .select("user_id, content_type, band_score, raw_score, total_questions, completed_at")
          .in("user_id", ids)
          .order("completed_at", { ascending: false })
          .limit(20000),
    emptyFilter
      ? Promise.resolve({ data: [] })
      : (service as any)
          .from("diagnostic_results")
          .select("user_id, band_reading, band_grammar, overall_band, created_at")
          .in("user_id", ids)
          .order("created_at", { ascending: false }),
    (service as any).from("user_test_attempts").select("id", { count: "exact", head: true }),
    (service as any).from("diagnostic_results").select("id", { count: "exact", head: true }),
  ]);

  const profiles = ((profilesResult as any).data ?? []) as ProfileRow[];
  const subscriptions = ((subscriptionsResult as any).data ?? []) as SubscriptionRow[];
  const attempts = ((attemptsResult as any).data ?? []) as AttemptRow[];
  const diagnostics = ((diagnosticsResult as any).data ?? []) as DiagnosticRow[];

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const subscriptionsByUser = newestByUser(subscriptions, "updated_at");
  const diagnosticsByUser = newestByUser(
    diagnostics.filter((row): row is DiagnosticRow & { user_id: string } => Boolean(row.user_id)),
    "created_at"
  );

  const attemptSummary = new Map<
    string,
    {
      count: number;
      lastActivityAt: string | null;
      lastBands: Record<ContentType, number | null>;
    }
  >();

  for (const attempt of attempts) {
    const summary =
      attemptSummary.get(attempt.user_id) ??
      ({
        count: 0,
        lastActivityAt: null,
        lastBands: { reading: null, listening: null, writing: null, speaking: null },
      } satisfies {
        count: number;
        lastActivityAt: string | null;
        lastBands: Record<ContentType, number | null>;
      });

    summary.count += 1;
    summary.lastActivityAt = dateMax([summary.lastActivityAt, attempt.completed_at]);
    if (summary.lastBands[attempt.content_type] === null && attempt.band_score !== null) {
      summary.lastBands[attempt.content_type] = attempt.band_score;
    }
    attemptSummary.set(attempt.user_id, summary);
  }

  const users = authUsers
    .map((authUser) => {
      const profile = profilesById.get(authUser.id) ?? null;
      const subscription = subscriptionsByUser.get(authUser.id) ?? null;
      const attemptsForUser = attemptSummary.get(authUser.id);
      const diagnostic = diagnosticsByUser.get(authUser.id) ?? null;

      return {
        id: authUser.id,
        name: profile?.name ?? metadataString(authUser, "name"),
        email: profile?.email ?? authUser.email ?? null,
        phone: profile?.phone ?? authUser.phone ?? metadataString(authUser, "phone"),
        createdAt: authUser.created_at ?? profile?.created_at ?? null,
        profileCreatedAt: profile?.created_at ?? null,
        profileUpdatedAt: profile?.updated_at ?? null,
        lastSignInAt: authUser.last_sign_in_at ?? null,
        hasProfile: Boolean(profile),
        isAdmin: Boolean(profile?.is_admin),
        targetBand: profile?.target_band ?? null,
        currentBand: profile?.current_band ?? null,
        examType: profile?.exam_type ?? null,
        goal: profile?.goal ?? null,
        examDate: profile?.exam_date ?? null,
        bands: {
          reading: profile?.band_reading ?? null,
          listening: profile?.band_listening ?? null,
          writing: profile?.band_writing ?? null,
          speaking: profile?.band_speaking ?? null,
        },
        lastBands: attemptsForUser?.lastBands ?? { reading: null, listening: null, writing: null, speaking: null },
        subscription,
        attemptsCount: attemptsForUser?.count ?? 0,
        lastActivityAt: attemptsForUser?.lastActivityAt ?? null,
        diagnostic,
      } satisfies AdminUserRow;
    })
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

  return {
    users,
    generatedAt: new Date().toISOString(),
    totalAuthUsers: authUsers.length,
    totalProfiles: profiles.length,
    totalPaidUsers: subscriptions.filter((sub) => sub.plan !== "free" && sub.status === "active").length,
    totalAttempts: (totalAttemptsResult as any).count ?? attempts.length,
    totalDiagnostics: (totalDiagnosticsResult as any).count ?? diagnostics.length,
    missingProfiles: authUsers.length - profiles.length,
  };
}

export async function getAdminContentCounts(): Promise<AdminContentCounts> {
  const service = createServiceClient();
  const [reading, listening, writing, speaking] = await Promise.all([
    (service as any).from("reading_tests").select("id", { count: "exact", head: true }),
    (service as any).from("listening_tests").select("id", { count: "exact", head: true }),
    (service as any).from("writing_tasks").select("id", { count: "exact", head: true }),
    (service as any).from("speaking_topics").select("id", { count: "exact", head: true }),
  ]);

  return {
    readingTests: reading.count ?? 0,
    listeningTests: listening.count ?? 0,
    writingTasks: writing.count ?? 0,
    speakingTopics: speaking.count ?? 0,
  };
}
