"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ProofSections } from "@/components/marketing/proof-sections";
import { cn } from "@/lib/utils";
import {
  Users, UserCog, CheckCircle2, Play,
  MessageCircle,
} from "lucide-react";

const BENEFITS = [
  "Индивидуальный план подготовки",
  "Опытные преподаватели с IELTS 8.0+",
  "Разбор всех 4 секций: Reading, Listening, Writing, Speaking",
  "Еженедельные mock-тесты с детальным фидбеком",
  "Стратегии и лайфхаки для каждого типа заданий",
  "Поддержка в чате 24/7",
];

const PLANS = [
  {
    name: "Групповой",
    description: "Мини-группы 6-8 человек",
    price: "220 000 ₸",
    period: "за весь курс",
    icon: Users,
    badge: "Популярный",
    badgeClassName: "bg-[rgb(var(--primary))] text-white",
    borderClassName: "border-[rgb(var(--primary))] ring-1 ring-[rgb(var(--primary)/0.22)]",
    iconClassName: "bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--primary))]",
    checkClassName: "text-[rgb(var(--success))]",
    sections: [
      {
        title: "ФОРМАТ",
        items: [
          "3 урока в неделю по 1.5 часа",
          "Speaking Club 2 раза/нед с носителем из США",
          "Mock-тесты каждую субботу на AI-платформе",
          "Живые уроки в Zoom — не запись",
        ],
      },
      {
        title: "ПРЕПОДАВАТЕЛИ",
        items: [
          "IELTS 7.5+ и опыт от 3 лет",
          "Разбор ошибок напрямую с учителем",
          "Фокус на ваши слабые стороны",
        ],
      },
      {
        title: "AI-ПЛАТФОРМА",
        checkClassName: "text-[rgb(var(--primary))]",
        items: [
          "Бесплатный доступ на всё время курса",
          "100+ Mock-тестов с AI-проверкой",
          "AI отслеживает прогресс",
          "Материалы и домашние задания",
        ],
      },
      {
        title: "ПОДДЕРЖКА",
        items: [
          "Личный ментор до экзамена",
          "Пробные тесты с разбором ошибок",
        ],
      },
    ],
  },
  {
    name: "Индивидуальное",
    description: "Персональный преподаватель 1-on-1",
    price: "420 000 ₸",
    period: "за весь курс",
    icon: UserCog,
    badge: "Макс. результат",
    badgeClassName: "bg-amber-50 text-amber-700 border border-amber-200",
    borderClassName: "border-amber-200",
    iconClassName: "bg-amber-50 text-amber-700",
    checkClassName: "text-amber-600",
    sections: [
      {
        title: "ВСЁ ИЗ ГРУППОВОГО, ПЛЮС",
        items: [
          "Персональный преподаватель только для вас",
          "Гибкое расписание — вы выбираете время",
          "Программа под ваш текущий балл",
          "100% внимания на ваши ошибки",
          "Интенсивный Speaking 1-on-1",
          "WhatsApp 24/7 с преподавателем",
        ],
      },
      {
        title: "ГАРАНТИЯ",
        items: [
          "Гарантия +1.5 band за 3 месяца",
          "Mock-экзамены с детальным разбором",
        ],
      },
    ],
  },
];

const WHATSAPP_URL = "https://wa.me/77001234567?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5!%20%D0%A5%D0%BE%D1%87%D1%83%20%D1%83%D0%B7%D0%BD%D0%B0%D1%82%D1%8C%20%D0%BF%D1%80%D0%BE%20%D0%BE%D0%B1%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5";

export default function LivePage() {
  return (
    <AppShell title="Живое Обучение">
      <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-10">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-[rgb(var(--foreground))] leading-tight">
            Запишитесь на полноценное обучение<br className="hidden sm:block" />
            в нашем центре подготовки к IELTS
          </h1>
          <p className="text-[rgb(var(--muted-foreground))] mt-3 max-w-2xl mx-auto">
            Живые занятия с опытными преподавателями + AI-платформа EZielts = максимальный результат
          </p>
        </div>

        {/* Benefits */}
        <div className="bg-white rounded-2xl border border-[rgb(var(--border))] p-6 shadow-sm">
          <h2 className="font-semibold text-lg text-[rgb(var(--foreground))] mb-4">Что вы получите:</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {BENEFITS.map((b) => (
              <div key={b} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-[rgb(var(--success))] shrink-0 mt-0.5" />
                <span className="text-sm text-[rgb(var(--foreground))]">{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="grid gap-5 lg:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-7",
                plan.borderClassName
              )}
            >
              <div className={cn("absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold shadow-sm", plan.badgeClassName)}>
                {plan.badge}
              </div>

              <div className="mb-5 flex items-center gap-4">
                <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", plan.iconClassName)}>
                  <plan.icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xl font-bold tracking-normal text-[rgb(var(--foreground))]">{plan.name}</div>
                  <div className="text-sm text-[rgb(var(--muted-foreground))]">{plan.description}</div>
                </div>
              </div>

              <div className="mb-6 rounded-2xl bg-[rgb(var(--surface-elevated))] p-5">
                <div className="text-4xl font-black tracking-normal text-[rgb(var(--foreground))]">{plan.price}</div>
                <div className="mt-2 text-sm font-semibold text-[rgb(var(--muted-foreground))]">{plan.period}</div>
              </div>

              <div className="flex flex-1 flex-col gap-5">
                {plan.sections.map((section, sectionIndex) => (
                  <div key={section.title} className={cn(sectionIndex > 0 && "border-t border-[rgb(var(--border))] pt-5")}>
                    <div className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[rgb(var(--muted-foreground))]">{section.title}</div>
                    <div className="flex flex-col gap-3">
                      {section.items.map((item) => (
                        <div key={item} className="flex items-start gap-2.5">
                          <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", section.checkClassName ?? plan.checkClassName)} />
                          <span className="text-sm font-medium leading-6 text-[rgb(var(--foreground))]">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-[#22B36A] px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#1EA05F]"
              >
                <MessageCircle className="h-4 w-4" />
                Записаться
              </a>
            </div>
          ))}
        </div>

        {/* Video placeholder */}
        <div className="bg-white rounded-2xl border border-[rgb(var(--border))] p-6 shadow-sm">
          <h2 className="font-semibold text-lg text-[rgb(var(--foreground))] mb-4">Как проходит обучение</h2>
          <div className="aspect-video bg-[rgb(var(--muted)/0.06)] border border-dashed border-[rgb(var(--border))] rounded-xl flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[rgb(var(--primary)/0.1)] flex items-center justify-center">
              <Play className="w-7 h-7 text-[rgb(var(--primary))] ml-1" />
            </div>
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Видео скоро будет добавлено</p>
          </div>
        </div>

        <ProofSections />

        {/* Bottom CTA */}
        <div className="bg-gradient-to-r from-[rgb(var(--primary))] to-violet-500 rounded-2xl p-8 text-center text-white">
          <h2 className="text-xl font-bold mb-2">Готовы начать подготовку?</h2>
          <p className="text-white/80 text-sm mb-5 max-w-md mx-auto">
            Напишите нам в WhatsApp — подберём подходящий формат и расскажем подробнее
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-[rgb(var(--primary))] font-semibold px-6 py-3 rounded-xl hover:bg-white/90 transition-colors text-sm"
          >
            <MessageCircle className="w-4 h-4" />
            Написать в WhatsApp
          </a>
        </div>

      </div>
    </AppShell>
  );
}
