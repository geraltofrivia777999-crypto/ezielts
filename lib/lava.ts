import { normalizePlan, type AppPlan, type PaidPlan } from "@/lib/plans";

export const LAVA_API_BASE = "https://gate.lava.top";
export const LAVA_CREATE_INVOICE_URL = `${LAVA_API_BASE}/api/v3/invoice`;
export const LAVA_CURRENCY = "USD";

const LAVA_OFFER_ENV: Record<PaidPlan, string> = {
  pro_monthly: "LAVA_OFFER_PRO_MONTHLY",
  pro_quarterly: "LAVA_OFFER_PRO_QUARTERLY",
  pro_annual: "LAVA_OFFER_PRO_ANNUAL",
};

const PLAN_MONTHS: Record<PaidPlan, number> = {
  pro_monthly: 1,
  pro_quarterly: 3,
  pro_annual: 12,
};

export type LavaInvoiceResponse = {
  id?: string;
  status?: string;
  paymentUrl?: string | null;
  amountTotal?: {
    amount?: number;
    currency?: string;
  };
};

export type LavaWebhookPayload = {
  eventType?: string;
  contractId?: string;
  parentContractId?: string;
  amount?: number;
  currency?: string;
  timestamp?: string;
  status?: string;
  errorMessage?: string;
  cancelledAt?: string;
  willExpireAt?: string;
  buyer?: {
    email?: string;
  };
  product?: {
    id?: string;
    title?: string;
  };
};

export function paidPlanFromUnknown(value: unknown): PaidPlan | null {
  const plan = normalizePlan(typeof value === "string" ? value : null);
  return plan === "free" ? null : plan;
}

export function getLavaOfferId(plan: PaidPlan): string | null {
  const value = process.env[LAVA_OFFER_ENV[plan]];
  return value && value.trim() ? value.trim() : null;
}

export function getLavaApiKey(): string | null {
  const value = process.env.LAVA_API_KEY;
  return value && value.trim() ? value.trim() : null;
}

export function getLavaWebhookKey(): string | null {
  const value = process.env.LAVA_WEBHOOK_KEY;
  return value && value.trim() ? value.trim() : null;
}

export function addPlanPeriod(start: Date, plan: PaidPlan): Date {
  const next = new Date(start);
  next.setUTCMonth(next.getUTCMonth() + PLAN_MONTHS[plan]);
  return next;
}

export function planFromLavaProductTitle(title: unknown): PaidPlan | null {
  if (typeof title !== "string") return null;
  const normalized = title.toLowerCase();
  if (normalized.includes("1 month")) return "pro_monthly";
  if (normalized.includes("3 months")) return "pro_quarterly";
  if (normalized.includes("12 months")) return "pro_annual";
  return null;
}

export function statusFromLavaEvent(eventType: string, payloadStatus?: string): string {
  if (eventType === "payment.success" || eventType === "subscription.recurring.payment.success") return "completed";
  if (eventType === "payment.failed" || eventType === "subscription.recurring.payment.failed") return "failed";
  if (eventType === "subscription.cancelled") return "cancelled";
  return payloadStatus || "received";
}

export function isSuccessfulLavaEvent(eventType: string): boolean {
  return eventType === "payment.success" || eventType === "subscription.recurring.payment.success";
}

export function planCheckoutRedirect(plan: AppPlan): string {
  const params = new URLSearchParams();
  params.set("premium", "1");
  if (plan !== "free") params.set("plan", plan);
  return `/signup?${params.toString()}`;
}
