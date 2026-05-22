import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type SB = SupabaseClient<Database>;

export const AI_SUBSCRIPTION_REQUIRED = {
  error: "subscription_required",
  message: "ИИ доступен только по подписке. Купите Pro, чтобы открыть AI-разборы, AI Writing, Speaking Coach, AI-план и AI-тьютора.",
};

export async function isProUser(sb: SB, userId: string): Promise<boolean> {
  const { data } = await (sb as any).rpc("is_pro", { uid: userId });
  return Boolean(data);
}

export function subscriptionRequiredResponse() {
  return new Response(
    JSON.stringify(AI_SUBSCRIPTION_REQUIRED),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}
