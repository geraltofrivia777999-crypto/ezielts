import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getPlanEntitlements, normalizePlan, type AppPlan } from "@/lib/plans";

type SB = SupabaseClient<Database>;

type ProAccessSummary = {
  is_pro?: boolean | null;
  plan?: string | null;
  subscription_status?: string | null;
  current_period_end?: string | null;
};

export const AI_SUBSCRIPTION_REQUIRED = {
  error: "subscription_required",
  message: "ИИ доступен только по подписке. Купите Pro, чтобы открыть AI-разборы, AI Writing, Speaking Coach, AI-план и AI-тьютора.",
};

export async function isProUser(sb: SB, userId: string): Promise<boolean> {
  try {
    const { data } = await sb.rpc("is_pro");
    if (Boolean(data)) return true;
  } catch {
    // Fall back to the summary view below. Some local/test clients may not
    // expose RPC, and older DB functions may not know every paid plan id.
  }

  try {
    const { data } = await sb
      .from("v_user_summary")
      .select("is_pro, plan, subscription_status, current_period_end")
      .eq("id", userId)
      .single();
    return hasActiveProAccess(data);
  } catch {
    return false;
  }
}

export async function getActivePlanForUser(sb: SB, userId: string): Promise<AppPlan> {
  try {
    const { data } = await sb
      .from("v_user_summary")
      .select("is_pro, plan, subscription_status, current_period_end")
      .eq("id", userId)
      .single();

    const summary = data as ProAccessSummary | null;
    if (!hasActiveProAccess(summary)) return "free";
    return normalizePlan(summary?.plan);
  } catch {
    return "free";
  }
}

export function hasActiveProAccess(summary: ProAccessSummary | null | undefined): boolean {
  if (!summary) return false;
  if (Boolean(summary.is_pro)) return true;

  const plan = String(summary.plan ?? "free");
  const status = String(summary.subscription_status ?? "");
  const activeStatus = status === "active" || status === "trialing";
  const notExpired = !summary.current_period_end || new Date(summary.current_period_end).getTime() > Date.now();

  return plan !== "free" && activeStatus && notExpired;
}

export function canUseProgressTracker(summary: ProAccessSummary | null | undefined): boolean {
  if (!hasActiveProAccess(summary)) return false;
  return getPlanEntitlements(summary?.plan).progressTracker;
}

export function subscriptionRequiredResponse() {
  return new Response(
    JSON.stringify(AI_SUBSCRIPTION_REQUIRED),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}
