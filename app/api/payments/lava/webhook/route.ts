import { createServiceClient } from "@/lib/supabase/server";
import {
  addPlanPeriod,
  getLavaWebhookKey,
  isSuccessfulLavaEvent,
  paidPlanFromUnknown,
  planFromLavaProductTitle,
  statusFromLavaEvent,
  type LavaWebhookPayload,
} from "@/lib/lava";
import type { Json } from "@/lib/supabase/types";

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() > b.getTime() ? a : b;
}

export async function POST(request: Request) {
  const expectedKey = getLavaWebhookKey();
  const incomingKey = request.headers.get("x-api-key");

  if (!expectedKey) {
    return Response.json({ error: "webhook_not_configured" }, { status: 500 });
  }

  if (!incomingKey || incomingKey !== expectedKey) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: LavaWebhookPayload;
  try {
    payload = (await request.json()) as LavaWebhookPayload;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const eventType = stringValue(payload.eventType);
  const contractId = stringValue(payload.contractId);

  if (!eventType || !contractId) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const service = createServiceClient();
  const nextPaymentStatus = statusFromLavaEvent(eventType, payload.status);

  const { data: payment } = await (service as any)
    .from("payments")
    .select("id, user_id, plan, status, provider_invoice_id, provider_offer_id")
    .eq("provider", "lava")
    .eq("provider_invoice_id", contractId)
    .maybeSingle();

  const existingPayment = payment as {
    id: string;
    user_id: string | null;
    plan: string | null;
    status: string | null;
    provider_invoice_id: string | null;
    provider_offer_id: string | null;
  } | null;

  const plan = paidPlanFromUnknown(existingPayment?.plan) ?? planFromLavaProductTitle(payload.product?.title);
  const buyerEmail = stringValue(payload.buyer?.email);
  let userId = existingPayment?.user_id ?? null;

  if (!userId && buyerEmail) {
    const { data: profile } = await (service as any)
      .from("profiles")
      .select("id")
      .eq("email", buyerEmail)
      .maybeSingle();
    userId = (profile as { id?: string } | null)?.id ?? null;
  }

  const paymentRecord: Record<string, unknown> = {
    user_id: userId,
    provider: "lava",
    provider_invoice_id: contractId,
    plan,
    amount: typeof payload.amount === "number" ? payload.amount : null,
    currency: payload.currency ?? null,
    status: nextPaymentStatus,
    event_type: eventType,
    raw_payload: payload as unknown as Json,
  };

  if (isSuccessfulLavaEvent(eventType)) {
    paymentRecord.paid_at = payload.timestamp ?? new Date().toISOString();
  }

  const { error: paymentError } = await (service as any)
    .from("payments")
    .upsert(paymentRecord, { onConflict: "provider_invoice_id" });

  if (paymentError) {
    return Response.json({ error: "payment_upsert_failed" }, { status: 500 });
  }

  if (
    isSuccessfulLavaEvent(eventType) &&
    existingPayment?.status !== "completed" &&
    userId &&
    plan
  ) {
    const now = payload.timestamp ? new Date(payload.timestamp) : new Date();
    const { data: subscription } = await (service as any)
      .from("subscriptions")
      .select("current_period_end, status")
      .eq("user_id", userId)
      .maybeSingle();

    const currentEndRaw = (subscription as { current_period_end?: string | null; status?: string | null } | null)?.current_period_end;
    const currentEnd = currentEndRaw ? new Date(currentEndRaw) : null;
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
          lava_contract_id: contractId,
          lava_offer_id: existingPayment?.provider_offer_id ?? null,
          payment_provider: "lava",
        },
        { onConflict: "user_id" }
      );

    if (subscriptionError) {
      return Response.json({ error: "subscription_upsert_failed" }, { status: 500 });
    }
  }

  if (eventType === "subscription.cancelled" && userId) {
    const { error: cancelError } = await (service as any)
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: payload.cancelledAt ?? new Date().toISOString(),
        current_period_end: payload.willExpireAt ?? null,
      })
      .eq("user_id", userId);

    if (cancelError) {
      return Response.json({ error: "subscription_cancel_failed" }, { status: 500 });
    }
  }

  return Response.json({ ok: true });
}
