import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isSyncableLavaPaymentStatus, syncLavaPaymentByInvoiceId, type LavaPaymentSyncResult } from "@/lib/lava-sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PaymentCandidate = {
  provider_invoice_id: string | null;
  status: string | null;
};

async function requireAdminApi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, response: Response.json({ error: "auth_required" }, { status: 401 }) };
  }

  const { data: profile, error } = await (supabase as any)
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile?.is_admin) {
    return { ok: false as const, response: Response.json({ error: "admin_required" }, { status: 403 }) };
  }

  return { ok: true as const };
}

function summarize(results: LavaPaymentSyncResult[]) {
  return {
    checked: results.length,
    activated: results.filter((item) => item.action === "activated").length,
    pending: results.filter((item) => item.action === "pending").length,
    failed: results.filter((item) => item.action === "failed").length,
    alreadyDone: results.filter((item) => item.action === "already_completed" || item.action === "already_applied").length,
    reviewRequired: results.filter((item) => item.action === "review_required").length,
    errors: results.filter((item) => item.action === "database_error" || item.action === "lava_error" || item.action === "not_configured").length,
  };
}

export async function POST() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const service = createServiceClient();
  const { data, error } = await (service as any)
    .from("payments")
    .select("provider_invoice_id, status")
    .eq("provider", "lava")
    .not("provider_invoice_id", "is", null)
    .neq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return Response.json({ error: "payments_lookup_failed" }, { status: 500 });
  }

  const candidates = ((data ?? []) as PaymentCandidate[])
    .filter((payment) => payment.provider_invoice_id && isSyncableLavaPaymentStatus(payment.status))
    .slice(0, 25);

  const results: LavaPaymentSyncResult[] = [];

  for (const candidate of candidates) {
    if (!candidate.provider_invoice_id) continue;
    results.push(await syncLavaPaymentByInvoiceId(candidate.provider_invoice_id));
  }

  return Response.json({
    ok: true,
    ...summarize(results),
    results,
  });
}
