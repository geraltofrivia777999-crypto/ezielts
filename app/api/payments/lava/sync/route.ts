import { isSyncableLavaPaymentStatus, syncLavaPaymentByInvoiceId, type LavaPaymentSyncResult } from "@/lib/lava-sync";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PaymentCandidate = {
  provider_invoice_id: string | null;
  status: string | null;
};

function summarize(results: LavaPaymentSyncResult[]) {
  return {
    checked: results.length,
    activated: results.filter((item) => item.action === "activated").length,
    pending: results.filter((item) => item.action === "pending").length,
    failed: results.filter((item) => item.action === "failed").length,
    errors: results.filter((item) => item.action === "database_error" || item.action === "lava_error" || item.action === "not_configured").length,
  };
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "auth_required" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data, error } = await (service as any)
    .from("payments")
    .select("provider_invoice_id, status")
    .eq("provider", "lava")
    .eq("user_id", user.id)
    .not("provider_invoice_id", "is", null)
    .neq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    return Response.json({ error: "payments_lookup_failed" }, { status: 500 });
  }

  const invoiceIds = ((data ?? []) as PaymentCandidate[])
    .filter((payment) => isSyncableLavaPaymentStatus(payment.status))
    .map((payment) => payment.provider_invoice_id)
    .filter((invoiceId): invoiceId is string => Boolean(invoiceId));

  const results: LavaPaymentSyncResult[] = [];

  for (const invoiceId of invoiceIds) {
    results.push(await syncLavaPaymentByInvoiceId(invoiceId));
  }

  return Response.json({
    ok: true,
    ...summarize(results),
    results,
  });
}
