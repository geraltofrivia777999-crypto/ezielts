import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  LAVA_CREATE_INVOICE_URL,
  LAVA_CURRENCY,
  getLavaApiKey,
  getLavaOfferId,
  paidPlanFromUnknown,
  planCheckoutRedirect,
  type LavaInvoiceResponse,
} from "@/lib/lava";
import type { Json } from "@/lib/supabase/types";

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const plan = paidPlanFromUnknown((body as { plan?: unknown } | null)?.plan);
  if (!plan) {
    return Response.json({ error: "invalid_plan" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      {
        error: "auth_required",
        message: "Создайте аккаунт или войдите, чтобы оплатить тариф.",
        redirectUrl: planCheckoutRedirect(plan),
      },
      { status: 401 }
    );
  }

  if (!user.email) {
    return Response.json({ error: "missing_email", message: "У аккаунта нет email для оплаты." }, { status: 400 });
  }

  const apiKey = getLavaApiKey();
  const offerId = getLavaOfferId(plan);

  if (!apiKey || !offerId) {
    return Response.json({ error: "payment_not_configured" }, { status: 500 });
  }

  const lavaResponse = await fetch(LAVA_CREATE_INVOICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      email: user.email,
      offerId,
      currency: LAVA_CURRENCY,
      buyerLanguage: "RU",
    }),
  });

  const lavaText = await lavaResponse.text();
  let invoice: LavaInvoiceResponse | null = null;
  try {
    invoice = lavaText ? (JSON.parse(lavaText) as LavaInvoiceResponse) : null;
  } catch {
    invoice = null;
  }

  if (!lavaResponse.ok || !invoice?.id || !invoice.paymentUrl) {
    return Response.json(
      {
        error: "lava_invoice_failed",
        message: "Не удалось создать оплату. Попробуйте ещё раз.",
        details: invoice ?? lavaText,
      },
      { status: 502 }
    );
  }

  const service = createServiceClient();
  const { error: paymentError } = await (service as any)
    .from("payments")
    .upsert(
      {
        user_id: user.id,
        provider: "lava",
        provider_invoice_id: invoice.id,
        provider_offer_id: offerId,
        plan,
        amount: invoice.amountTotal?.amount ?? null,
        currency: invoice.amountTotal?.currency ?? LAVA_CURRENCY,
        status: invoice.status ?? "in-progress",
        raw_payload: invoice as unknown as Json,
      },
      { onConflict: "provider_invoice_id" }
    );

  if (paymentError) {
    return Response.json(
      {
        error: "payment_record_failed",
        message: "Оплата создана, но не удалось сохранить её в системе. Обновите страницу и попробуйте снова.",
      },
      { status: 500 }
    );
  }

  return Response.json({
    paymentUrl: invoice.paymentUrl,
    invoiceId: invoice.id,
  });
}
