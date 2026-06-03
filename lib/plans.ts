import { WHATSAPP_CONTACT_URL } from "@/lib/contact";

export type PaidPlan = "pro_monthly" | "pro_quarterly" | "pro_annual";
export type AppPlan = "free" | PaidPlan;

export type AiTutorLevel = "none" | "basic" | "advanced";
export type StudyPlanLevel = "none" | "general_14_days" | "personal";

export type PlanEntitlements = {
  readingListeningTests: boolean;
  allTestsUnlimited: boolean;
  writingChecksPerWeek: number | null;
  speakingSessionsPerWeek: number | null;
  aiTutor: AiTutorLevel;
  studyPlan: StudyPlanLevel;
  mockExams: number | null;
  detailedErrorAnalysis: boolean;
  progressTracker: boolean;
  guaranteePlusOneBand: boolean;
  earlyFeatures: boolean;
  vocabularyBuilder: boolean;
  pastExamReview: boolean;
};

export type PricingPlan = {
  id: PaidPlan;
  eyebrow: string;
  name: string;
  price: number;
  periodLabel: string;
  monthlyLabel?: string;
  badge?: string;
  checkoutHref: string;
  included: string[];
  excluded?: string[];
  accent: "neutral" | "blue" | "gold";
};

export const PLAN_ENTITLEMENTS: Record<AppPlan, PlanEntitlements> = {
  free: {
    readingListeningTests: true,
    allTestsUnlimited: false,
    writingChecksPerWeek: 0,
    speakingSessionsPerWeek: 0,
    aiTutor: "none",
    studyPlan: "none",
    mockExams: 0,
    detailedErrorAnalysis: false,
    progressTracker: false,
    guaranteePlusOneBand: false,
    earlyFeatures: false,
    vocabularyBuilder: false,
    pastExamReview: false,
  },
  pro_monthly: {
    readingListeningTests: true,
    allTestsUnlimited: false,
    writingChecksPerWeek: 3,
    speakingSessionsPerWeek: 3,
    aiTutor: "basic",
    studyPlan: "general_14_days",
    mockExams: 0,
    detailedErrorAnalysis: false,
    progressTracker: false,
    guaranteePlusOneBand: false,
    earlyFeatures: false,
    vocabularyBuilder: false,
    pastExamReview: false,
  },
  pro_quarterly: {
    readingListeningTests: true,
    allTestsUnlimited: true,
    writingChecksPerWeek: null,
    speakingSessionsPerWeek: null,
    aiTutor: "advanced",
    studyPlan: "personal",
    mockExams: 2,
    detailedErrorAnalysis: true,
    progressTracker: true,
    guaranteePlusOneBand: true,
    earlyFeatures: false,
    vocabularyBuilder: false,
    pastExamReview: false,
  },
  pro_annual: {
    readingListeningTests: true,
    allTestsUnlimited: true,
    writingChecksPerWeek: null,
    speakingSessionsPerWeek: null,
    aiTutor: "advanced",
    studyPlan: "personal",
    mockExams: null,
    detailedErrorAnalysis: true,
    progressTracker: true,
    guaranteePlusOneBand: true,
    earlyFeatures: true,
    vocabularyBuilder: true,
    pastExamReview: true,
  },
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "pro_monthly",
    eyebrow: "Попробовать",
    name: "1 месяц",
    price: 15,
    periodLabel: "за месяц",
    checkoutHref: WHATSAPP_CONTACT_URL,
    accent: "neutral",
    included: [
      "Reading + Listening тесты",
      "Writing — 3 проверки/нед",
      "Speaking — 3 сессии/нед",
      "AI Tutor — базовый",
      "Общий план на 14 дней",
    ],
    excluded: [
      "Mock-экзамены",
      "Детальный анализ ошибок",
      "Прогресс-трекер",
    ],
  },
  {
    id: "pro_quarterly",
    eyebrow: "Подготовиться",
    name: "3 месяца",
    price: 36,
    periodLabel: "за 3 месяца",
    monthlyLabel: "$12/мес — экономия 20%",
    badge: "Лучший выбор",
    checkoutHref: WHATSAPP_CONTACT_URL,
    accent: "blue",
    included: [
      "Все тесты без лимита",
      "Writing — безлимит",
      "Speaking — безлимит",
      "AI Tutor — продвинутый",
      "Персональный AI-план",
      "2 Mock-экзамена с разбором",
      "Детальный анализ ошибок",
      "Прогресс-трекер + статистика",
      "Гарантия +1 band",
    ],
  },
  {
    id: "pro_annual",
    eyebrow: "Максимум",
    name: "12 месяцев",
    price: 99,
    periodLabel: "за 12 месяцев",
    monthlyLabel: "$8.25/мес — экономия 45%",
    checkoutHref: WHATSAPP_CONTACT_URL,
    accent: "gold",
    included: [
      "Всё из 3 месяцев",
      "Mock-экзамены — безлимит",
      "Доступ к новым фичам первым",
      "Vocabulary Builder",
      "AI-разбор прошлых экзаменов",
    ],
  },
];

export function normalizePlan(plan: string | null | undefined): AppPlan {
  if (plan === "pro_monthly" || plan === "pro_quarterly" || plan === "pro_annual") return plan;
  return "free";
}

export function getPlanEntitlements(plan: string | null | undefined): PlanEntitlements {
  return PLAN_ENTITLEMENTS[normalizePlan(plan)];
}

export function getPricingPlan(plan: string | null | undefined): PricingPlan | null {
  const normalized = normalizePlan(plan);
  if (normalized === "free") return null;
  return PRICING_PLANS.find((item) => item.id === normalized) ?? null;
}

export function getPlanDisplayName(plan: string | null | undefined): string {
  const pricingPlan = getPricingPlan(plan);
  if (pricingPlan) return pricingPlan.name;
  return "Бесплатный план";
}
