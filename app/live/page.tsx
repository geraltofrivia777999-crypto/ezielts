"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Users, User, CheckCircle2, Play,
  MessageCircle, Star, Quote,
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
    name: "Групповое",
    description: "Занятия в мини-группах до 6 человек",
    price: "45 000",
    period: "тг/мес",
    icon: Users,
    color: "bg-blue-500",
    lightBg: "bg-blue-50",
    lightColor: "text-blue-600",
    features: [
      "3 занятия в неделю по 1.5 часа",
      "Группа до 6 человек",
      "Домашние задания с проверкой",
      "Mock-тесты каждую неделю",
      "Доступ к EZielts Pro",
      "Сертификат по окончании",
    ],
    popular: false,
  },
  {
    name: "Индивидуальное",
    description: "Персональные занятия 1 на 1 с преподавателем",
    price: "90 000",
    period: "тг/мес",
    icon: User,
    color: "bg-[rgb(var(--primary))]",
    lightBg: "bg-violet-50",
    lightColor: "text-[rgb(var(--primary))]",
    features: [
      "Гибкий график занятий",
      "Полностью персональная программа",
      "Фокус на ваших слабых местах",
      "Mock-тесты с детальным разбором",
      "Доступ к EZielts Pro",
      "Гарантия улучшения на 1.0+ балл",
    ],
    popular: true,
  },
];

const REVIEWS = [
  {
    name: "Айгерим К.",
    score: "5.5 → 7.0",
    text: "За 2 месяца подняла балл с 5.5 до 7.0! Преподаватель объяснил все стратегии для Reading и Listening. Writing подтянули благодаря еженедельным эссе с разбором каждой ошибки.",
    avatar: "А",
    color: "bg-pink-100 text-pink-600",
  },
  {
    name: "Тимур М.",
    score: "6.0 → 7.5",
    text: "Групповые занятия оказались очень эффективными. Конкуренция в группе мотивирует, а преподаватель уделяет внимание каждому. Speaking Part 2 перестал быть проблемой после mock-интервью.",
    avatar: "Т",
    color: "bg-blue-100 text-blue-600",
  },
  {
    name: "Дана С.",
    score: "6.5 → 8.0",
    text: "Индивидуальные занятия — лучшее решение. Программу подстроили полностью под меня, сфокусировались на Writing Task 2 и Speaking. Результат превзошёл ожидания!",
    avatar: "Д",
    color: "bg-emerald-100 text-emerald-600",
  },
  {
    name: "Арман Б.",
    score: "5.0 → 6.5",
    text: "Начинал почти с нуля. За 3 месяца группового обучения набрал нужный балл для поступления. Очень помогли mock-тесты — на реальном экзамене чувствовал себя уверенно.",
    avatar: "А",
    color: "bg-amber-100 text-amber-600",
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
        <div className="grid sm:grid-cols-2 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative bg-white rounded-2xl border p-6 flex flex-col shadow-sm",
                plan.popular
                  ? "border-[rgb(var(--primary))] ring-1 ring-[rgb(var(--primary)/0.2)]"
                  : "border-[rgb(var(--border))]"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[rgb(var(--primary))] text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Популярный
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", plan.lightBg)}>
                  <plan.icon className={cn("w-5 h-5", plan.lightColor)} />
                </div>
                <div>
                  <div className="font-semibold text-[rgb(var(--foreground))]">{plan.name}</div>
                  <div className="text-xs text-[rgb(var(--muted-foreground))]">{plan.description}</div>
                </div>
              </div>

              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-3xl font-bold text-[rgb(var(--foreground))]">{plan.price}</span>
                <span className="text-sm text-[rgb(var(--muted-foreground))]">{plan.period}</span>
              </div>

              <div className="flex flex-col gap-2.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[rgb(var(--success))] shrink-0 mt-0.5" />
                    <span className="text-sm text-[rgb(var(--foreground))]">{f}</span>
                  </div>
                ))}
              </div>

              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors",
                  plan.popular
                    ? "bg-[rgb(var(--primary))] text-white hover:bg-[rgb(var(--primary)/0.9)]"
                    : "bg-green-500 text-white hover:bg-green-600"
                )}
              >
                <MessageCircle className="w-4 h-4" />
                Записаться в WhatsApp
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

        {/* Reviews */}
        <div>
          <h2 className="font-semibold text-lg text-[rgb(var(--foreground))] mb-4">Отзывы наших студентов</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {REVIEWS.map((r) => (
              <div
                key={r.name}
                className="bg-white rounded-2xl border border-[rgb(var(--border))] p-5 shadow-sm flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm", r.color)}>
                    {r.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-[rgb(var(--foreground))]">{r.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                  <div className="bg-emerald-50 text-emerald-600 text-xs font-bold px-2.5 py-1 rounded-full">
                    {r.score}
                  </div>
                </div>
                <div className="relative">
                  <Quote className="w-4 h-4 text-[rgb(var(--muted))] absolute -top-0.5 -left-0.5 opacity-40" />
                  <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed pl-4">
                    {r.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

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
