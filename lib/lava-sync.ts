import { addPlanPeriod, getLavaApiKey, LAVA_INVOICE_URL, paidPlanFromUnknown, planFromLavaProductTitle, type LavaInvoiceDetails } from "@/lib/lava";
import type { PaidPlan } from "@/lib/plans";
import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

type PaymentRow = {
  id: string;
  user_id: string | null;
  provider_invoice_id: string | null;
  provider_offer_id: string | null;
  plan: string | null;
  status: string | null;
  created_at: string;
};

export type LavaPaymentSyncResult = {
  invoiceId: string;
  email: string | null;
  plan: PaidPlan | null;
  lavaStatus: string | null;
  paymentStatus: string;
  action:
    | "activated"
    | "already_completed"
    | "already_applied"
    | "pending"
    | "failed"
    | "review_required"
    | "not_found"
    | "lava_error"
    | "database_error"
    | "not_configured";
  message: string;
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() > b.getTime() ? a : b;
}

function normalizeLavaStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function paymentStatusFromInvoiceStatus(status: unknown): string {
  switch (normalizeLavaStatus(status)) {
    case "COMPLETED":
      return "completed";
    case "FAILED":
      return "failed";
    case "NEW":
      return "new";
    case "IN_PROGRESS":
      return "in-progress";
    default:
      return typeof status === "string" && status.trim() ? status.trim().toLowerCase() : "unknown";
  }
}

function planFromInvoice(invoice: LavaInvoiceDetails, fallback: unknown): PaidPlan | null {
  const fromPayment = paidPlanFromUnknown(fallback);
  if (fromPayment) return fromPayment;

  const productParts = [
    invoice.product?.title,
    invoice.product?.name,
    invoice.product?.offer,
  ].filter(Boolean);

  return planFromLavaProductTitle(productParts.join(" "));
}

function invoiceAmount(invoice: LavaInvoiceDetails): number | null {
  return typeof invoice.receipt?.amount === "number"
    ? invoice.receipt.amount
    : typeof invoice.amountTotal?.amount === "number"
      ? invoice.amountTotal.amount
      : null;
}

function invoiceCurrency(invoice: LavaInvoiceDetails): string | null {
  return stringValue(invoice.receipt?.currency) ?? stringValue(invoice.amountTotal?.currency);
}

async function updatePaymentRecord(service: ReturnType<typeof createServiceClient>, paymentId: string, update: Record<string, unknown>) {
  return (service as any)
    .from("payments")
    .update(update)
    .eq("id", paymentId);
}

async function fetchLavaInvoice(invoiceId: string): Promise<{ invoice: LavaInvoiceDetails | null; error: string | null }> {
  const apiKey = getLavaApiKey();
  if (!apiKey) {
    return { invoice: null, error: "LAVA_API_KEY не настроен" };
  }

  const response = await fetch(`${LAVA_INVOICE_URL}/${encodeURIComponent(invoiceId)}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    cache: "no-store",
  });

  const text = await response.text();
  let parsed: LavaInvoiceDetails | null = null;
  try {
    parsed = text ? (JSON.parse(text) as LavaInvoiceDetails) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok || !parsed?.id) {
    return { invoice: null, error: `Lava вернула ${response.status}` };
  }

  return { invoice: parsed, error: null };
}

async function resolveUserId(service: ReturnType<typeof createServiceClient>, payment: PaymentRow, buyerEmail: string | null) {
  if (payment.user_id) return payment.user_id;
  if (!buyerEmail) return null;

  const { data } = await (service as any)
    .from("profiles")
    .select("id")
    .ilike("email", buyerEmail)
    .maybeSingle();

  return (data as { id?: string } | null)?.id ?? null;
}

export async function syncLavaPaymentByInvoiceId(invoiceId: string): Promise<LavaPaymentSyncResult> {
  const service = createServiceClient();

  const { data: paymentData, error: paymentLookupError } = await (service as any)
    .from("payments")
    .select("id, user_id, provider_invoice_id, provider_offer_id, plan, status, created_at")
    .eq("provider", "lava")
    .eq("provider_invoice_id", invoiceId)
    .maybeSingle();

  if (paymentLookupError) {
    return {
      invoiceId,
      email: null,
      plan: null,
      lavaStatus: null,
      paymentStatus: "unknown",
      action: "database_error",
      message: "Не удалось прочитать payment из базы",
    };
  }

  const payment = paymentData as PaymentRow | null;
  if (!payment) {
    return {
      invoiceId,
      email: null,
      plan: null,
      lavaStatus: null,
      paymentStatus: "not_found",
      action: "not_found",
      message: "Payment с таким invoiceId не найден в базе",
    };
  }

  const { invoice, error: lavaError } = await fetchLavaInvoice(invoiceId);
  if (lavaError || !invoice) {
    return {
      invoiceId,
      email: null,
      plan: paidPlanFromUnknown(payment.plan),
      lavaStatus: null,
      paymentStatus: payment.status ?? "unknown",
      action: lavaError === "LAVA_API_KEY не настроен" ? "not_configured" : "lava_error",
      message: lavaError ?? "Не удалось получить invoice из Lava",
    };
  }

  const lavaStatus = normalizeLavaStatus(invoice.status);
  const nextPaymentStatus = paymentStatusFromInvoiceStatus(invoice.status);
  const buyerEmail = stringValue(invoice.buyer?.email);
  const plan = planFromInvoice(invoice, payment.plan);
  const userId = await resolveUserId(service, payment, buyerEmail);
  const paidAt = stringValue(invoice.datetime) ?? new Date().toISOString();

  const paymentUpdate: Record<string, unknown> = {
    user_id: userId,
    status: nextPaymentStatus,
    event_type: `lava.api_sync.${nextPaymentStatus}`,
    raw_payload: { source: "lava_api_sync", invoice } as unknown as Json,
    amount: invoiceAmount(invoice),
    currency: invoiceCurrency(invoice),
  };

  if (plan) paymentUpdate.plan = plan;
  if (nextPaymentStatus === "completed") paymentUpdate.paid_at = paidAt;

  if (nextPaymentStatus !== "completed") {
    const { error: paymentUpdateError } = await updatePaymentRecord(service, payment.id, paymentUpdate);

    if (paymentUpdateError) {
      return {
        invoiceId,
        email: buyerEmail,
        plan,
        lavaStatus,
        paymentStatus: nextPaymentStatus,
        action: "database_error",
        message: "Lava invoice прочитан, но payment не обновился",
      };
    }

    if (nextPaymentStatus === "failed") {
      return {
        invoiceId,
        email: buyerEmail,
        plan,
        lavaStatus,
        paymentStatus: nextPaymentStatus,
        action: "failed",
        message: "Оплата в Lava завершилась ошибкой",
      };
    }

    return {
      invoiceId,
      email: buyerEmail,
      plan,
      lavaStatus,
      paymentStatus: nextPaymentStatus,
      action: "pending",
      message: "Оплата ещё не завершена",
    };
  }

  if (!userId || !plan) {
    await updatePaymentRecord(service, payment.id, paymentUpdate);

    return {
      invoiceId,
      email: buyerEmail,
      plan,
      lavaStatus,
      paymentStatus: nextPaymentStatus,
      action: "review_required",
      message: "Оплата успешна, но не удалось определить пользователя или тариф",
    };
  }

  const { data: subscriptionData } = await (service as any)
    .from("subscriptions")
    .select("plan, status, current_period_end, lava_contract_id")
    .eq("user_id", userId)
    .maybeSingle();

  const subscription = subscriptionData as { plan?: string | null; status?: string | null; current_period_end?: string | null; lava_contract_id?: string | null } | null;
  if (subscription?.lava_contract_id === invoiceId) {
    await updatePaymentRecord(service, payment.id, paymentUpdate);

    return {
      invoiceId,
      email: buyerEmail,
      plan,
      lavaStatus,
      paymentStatus: nextPaymentStatus,
      action: "already_applied",
      message: "Эта Lava оплата уже привязана к подписке",
    };
  }

  if (
    payment.status === "completed" &&
    subscription?.status === "active" &&
    subscription?.plan &&
    subscription.plan !== "free" &&
    subscription?.lava_contract_id &&
    subscription.lava_contract_id !== invoiceId
  ) {
    return {
      invoiceId,
      email: buyerEmail,
      plan,
      lavaStatus,
      paymentStatus: nextPaymentStatus,
      action: "already_completed",
      message: "Payment уже был completed, повторно подписка не начислялась",
    };
  }

  const now = safeDate(paidAt) ?? new Date();
  const currentEnd = safeDate(subscription?.current_period_end);
  const base = currentEnd && currentEnd.getTime() > now.getTime() ? maxDate(currentEnd, now) : now;
  const nextEnd = addPlanPeriod(base, plan);

  const { error: subscriptionError } = await (service as any)
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        plan,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: nextEnd.toISOString(),
        cancelled_at: null,
        lava_contract_id: invoiceId,
        lava_offer_id: payment.provider_offer_id,
        payment_provider: "lava",
      },
      { onConflict: "user_id" }
    );

  if (subscriptionError) {
    return {
      invoiceId,
      email: buyerEmail,
      plan,
      lavaStatus,
      paymentStatus: nextPaymentStatus,
      action: "database_error",
      message: "Payment completed, но подписка не обновилась",
    };
  }

  const { error: paymentCompleteError } = await updatePaymentRecord(service, payment.id, paymentUpdate);

  if (paymentCompleteError) {
    return {
      invoiceId,
      email: buyerEmail,
      plan,
      lavaStatus,
      paymentStatus: nextPaymentStatus,
      action: "database_error",
      message: "Подписка обновилась, но payment не пометился completed",
    };
  }

  return {
    invoiceId,
    email: buyerEmail,
    plan,
    lavaStatus,
    paymentStatus: nextPaymentStatus,
    action: "activated",
    message: "Подписка активирована",
  };
}

export function isSyncableLavaPaymentStatus(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return ["created", "received", "new", "in-progress", "in_progress", "unknown"].includes(normalized);
}
