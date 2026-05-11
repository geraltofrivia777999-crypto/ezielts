import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/layout/navbar";
import {
  CheckCircle2,
  BookOpen,
  Headphones,
  PenLine,
  Mic2,
  Zap,
  TrendingUp,
  Shield,
  ChevronRight,
  Star,
  Users,
  Clock,
} from "lucide-react";

// ─── Static data ────────────────────────────────────────────────────────────

const SKILLS = [
  { icon: BookOpen, label: "Reading", color: "text-blue-500", bg: "bg-blue-50" },
  { icon: Headphones, label: "Listening", color: "text-purple-500", bg: "bg-purple-50" },
  { icon: PenLine, label: "Writing", color: "text-[rgb(var(--secondary))]", bg: "bg-teal-50" },
  { icon: Mic2, label: "Speaking", color: "text-[rgb(var(--primary))]", bg: "bg-violet-50" },
];

const FEATURES = [
  {
    icon: BookOpen,
    title: "750+ реальных Reading тестов",
    description:
      "Cambridge, British Council, IELTS.org — все уровни от Academic до General. Подсветка, заметки, таймер.",
  },
  {
    icon: Headphones,
    title: "38 Listening тестов с аудио",
    description:
      "Секции 1–4, разные акценты, формат строго по IELTS. Перемотка запрещена — как на экзамене.",
  },
  {
    icon: Zap,
    title: "AI Writing Feedback",
    description:
      "Оценка по всем 4 критериям IELTS (TA, CC, LR, GRA) с конкретными комментариями. Claude Sonnet.",
  },
  {
    icon: Mic2,
    title: "AI Speaking Coach",
    description:
      "Запись ответов прямо в браузере → транскрипция → оценка Fluency, Coherence, Vocab, Grammar.",
  },
  {
    icon: TrendingUp,
    title: "График прогресса",
    description:
      "Видишь как растёт band по каждому навыку. Тепловая карта ошибок показывает слабые типы вопросов.",
  },
  {
    icon: Shield,
    title: "Гарантия +1 балл",
    description:
      "+1 к band за 3 месяца или возврат 100%. Работает потому что алгоритм всегда учит слабые места.",
  },
];

const TESTIMONIALS = [
  {
    name: "Алия М.",
    city: "Алматы",
    before: 5.5,
    after: 7.0,
    text: "За 3 месяца подняла с 5.5 до 7.0. AI Writing давал такой же фидбек как репетитор, но в любое время ночи.",
  },
  {
    name: "Дмитрий К.",
    city: "Бишкек",
    before: 6.0,
    after: 7.5,
    text: "Reading за счёт большого банка тестов — наконец перестал угадывать типы вопросов. 7.5 с первого раза!",
  },
  {
    name: "Санжар Б.",
    city: "Ташкент",
    before: 6.5,
    after: 8.0,
    text: "Speaking Coach — это находка. Слышишь себя со стороны + видишь что именно снижало Fluency.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: 0,
    period: "",
    description: "Попробуй платформу",
    features: [
      "1 Reading тест / день",
      "1 Listening тест / день",
      "1 Writing без AI / неделю",
      "График прогресса",
      "3 вопроса AI-Tutor",
    ],
    cta: "Начать бесплатно",
    href: "/diagnostic",
    highlight: false,
  },
  {
    name: "Pro",
    price: 8,
    period: "/ мес",
    description: "Серьёзная подготовка",
    features: [
      "Безлимитные тесты",
      "AI Writing Feedback",
      "AI Speaking Coach",
      "Персональный план",
      "AI-Tutor без лимитов",
      "Гарантия +1 балл",
    ],
    cta: "Начать Pro — $8/мес",
    href: "/signup?plan=pro",
    highlight: true,
  },
  {
    name: "Pro Год",
    price: 4,
    period: "/ мес",
    description: "Лучшая ценность ($48/год)",
    features: [
      "Всё из Pro",
      "Экономия 50%",
      "Приоритетная поддержка",
      "Ранний доступ к новым тестам",
    ],
    cta: "Начать годовой план",
    href: "/signup?plan=annual",
    highlight: false,
    tag: "ЛУЧШАЯ ЦЕНА",
  },
];

const FAQ = [
  {
    q: "Тесты настоящие или сгенерированные AI?",
    a: "Все тесты взяты с официальных источников IELTS — Cambridge, British Council, practicepteonline. AI используется только для фидбека по Writing и Speaking.",
  },
  {
    q: "Что если не сдам на нужный балл?",
    a: "При подписке Pro на 3+ месяца — гарантия +1 к band. Если результат не вырос, возвращаем 100% оплаты.",
  },
  {
    q: "Работает ли платформа для General Training?",
    a: "Да! Банк тестов включает оба модуля — Academic и General Training. При регистрации выбираешь свой тип.",
  },
  {
    q: "Можно ли платить с казахстанской/российской карты?",
    a: "Да, принимаем Visa и Mastercard казахстанских и российских банков, включая Kaspi, Halyk, Сбербанк.",
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  if (params.code) {
    const { redirect } = await import("next/navigation");
    redirect(`/api/auth/callback?code=${encodeURIComponent(params.code)}&next=/reset-password`);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative pt-24 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        {/* Background gradient blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-[0.07]"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--primary)) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 w-[400px] h-[400px] rounded-full opacity-[0.05]"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--secondary)) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl">
            {/* Social proof chip */}
            <div className="flex items-center gap-2 mb-6">
              <Badge variant="default" className="gap-1.5 py-1 px-3">
                <Star className="w-3 h-3 fill-current" />
                <span>3 000+ студентов из СНГ</span>
              </Badge>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight text-[rgb(var(--foreground))] mb-6">
              Сдай IELTS{" "}
              <span
                className="relative inline-block"
                style={{ color: "rgb(var(--primary))" }}
              >
                с первого раза
                {/* underline decoration */}
                <svg
                  aria-hidden
                  className="absolute -bottom-2 left-0 w-full"
                  viewBox="0 0 300 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 8 C50 2, 150 14, 298 6"
                    stroke="rgb(var(--secondary))"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-[rgb(var(--muted-foreground))] leading-relaxed mb-8 max-w-xl">
              Реальные тесты, AI-фидбек по writing и speaking, персональный план
              подготовки. Гарантия{" "}
              <strong className="text-[rgb(var(--foreground))]">
                +1 балл за 3 месяца
              </strong>{" "}
              или возврат денег.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <Button size="xl" asChild className="shadow-lg shadow-[rgb(var(--primary)/0.25)]">
                <Link href="/diagnostic">
                  Узнай свой уровень за 15 минут
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link href="#features">Как это работает</Link>
              </Button>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap gap-5 text-sm text-[rgb(var(--muted-foreground))]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[rgb(var(--success))]" />
                Без регистрации для диагностики
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[rgb(var(--success))]" />
                Бесплатный план навсегда
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[rgb(var(--success))]" />
                Данные карты не нужны
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: BookOpen, value: "750+", label: "Reading тестов" },
            { icon: Headphones, value: "38", label: "Listening тестов" },
            { icon: PenLine, value: "310+", label: "Writing заданий" },
            { icon: Users, value: "3 000+", label: "Студентов" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[rgb(var(--primary)/0.1)] flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[rgb(var(--primary))]" />
              </div>
              <div>
                <div className="text-xl font-bold text-[rgb(var(--foreground))]">{value}</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 bg-[rgb(var(--background))]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-3">Как это работает</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-[rgb(var(--foreground))] mb-4">
              От нуля до нужного балла
            </h2>
            <p className="text-[rgb(var(--muted-foreground))] max-w-xl mx-auto">
              Адаптивная система обучения — учит именно то, что снижает твой балл.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Диагностика",
                desc: "15-минутный тест без регистрации. Reading + Listening + Grammar. Сразу видишь свои слабые места.",
                cta: null,
              },
              {
                step: "02",
                title: "Практика",
                desc: "Каждый день новые тесты из огромного банка. Алгоритм подбирает задания по слабым типам вопросов.",
                cta: null,
              },
              {
                step: "03",
                title: "AI-фидбек",
                desc: "Отправляешь Writing/Speaking — получаешь оценку по всем критериям IELTS с конкретными улучшениями.",
                cta: null,
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="relative">
                {/* Step connector line (desktop) */}
                <div className="hidden md:block absolute top-5 left-full w-full h-px bg-[rgb(var(--border))] -translate-x-1/2 last:hidden" />
                <div className="flex flex-col gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-mono font-bold text-white"
                    style={{ background: "rgb(var(--primary))" }}
                  >
                    {step}
                  </div>
                  <h3 className="text-xl font-semibold text-[rgb(var(--foreground))]">{title}</h3>
                  <p className="text-[rgb(var(--muted-foreground))] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-20 bg-[rgb(var(--surface))]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <Badge variant="default" className="mb-3">Возможности</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-[rgb(var(--foreground))] mb-4">
              Всё что нужно для сдачи
            </h2>
          </div>

          {/* Skills */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {SKILLS.map(({ icon: Icon, label, color, bg }) => (
              <div
                key={label}
                className={`flex items-center gap-2 px-4 py-2 rounded-full ${bg} ${color} font-medium text-sm`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <Card
                key={title}
                className="group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <CardContent className="p-6 flex flex-col gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[rgb(var(--primary)/0.1)] flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[rgb(var(--primary))]" />
                  </div>
                  <h3 className="font-semibold text-[rgb(var(--foreground))]">{title}</h3>
                  <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 bg-[rgb(var(--background))]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <Badge variant="success" className="mb-3">Результаты студентов</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-[rgb(var(--foreground))] mb-4">
              Реальные истории, реальные баллы
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ name, city, before, after, text }) => (
              <Card key={name} className="flex flex-col gap-0">
                <CardContent className="p-6 flex flex-col gap-4 h-full">
                  {/* Band change */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-2xl font-bold text-[rgb(var(--band-mid))]">
                      {before}
                    </span>
                    <TrendingUp className="w-5 h-5 text-[rgb(var(--success))]" />
                    <span className="font-mono text-2xl font-bold text-[rgb(var(--band-high))]">
                      {after}
                    </span>
                    <Badge variant="success" className="ml-auto">
                      +{(after - before).toFixed(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed flex-1">
                    &ldquo;{text}&rdquo;
                  </p>
                  <div className="flex items-center gap-2 pt-2 border-t border-[rgb(var(--border))]">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: "rgb(var(--primary))" }}
                    >
                      {name[0]}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[rgb(var(--foreground))]">{name}</div>
                      <div className="text-xs text-[rgb(var(--muted))]">{city}</div>
                    </div>
                    <div className="ml-auto flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 text-[rgb(var(--warning))] fill-current" />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-20 bg-[rgb(var(--surface))]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <Badge variant="default" className="mb-3">Тарифы</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-[rgb(var(--foreground))] mb-4">
              Прозрачные цены без скрытых платежей
            </h2>
            <p className="text-[rgb(var(--muted-foreground))]">
              Начни бесплатно, улучши план когда будешь готов
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PLANS.map((plan) => (
              <div key={plan.name} className="relative">
                {plan.tag && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap"
                    style={{ background: "rgb(var(--secondary))" }}
                  >
                    {plan.tag}
                  </div>
                )}
                <Card
                  className={
                    plan.highlight
                      ? "border-[rgb(var(--primary))] shadow-lg shadow-[rgb(var(--primary)/0.12)] relative"
                      : ""
                  }
                >
                  {plan.highlight && (
                    <div
                      className="absolute inset-0 rounded-[calc(var(--radius)*1.5)] pointer-events-none"
                      style={{
                        background:
                          "linear-gradient(180deg, rgb(var(--primary)/0.03) 0%, transparent 100%)",
                      }}
                    />
                  )}
                  <CardContent className="p-6 flex flex-col gap-5">
                    <div>
                      <div className="text-sm font-medium text-[rgb(var(--muted-foreground))] mb-1">
                        {plan.name}
                      </div>
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-bold text-[rgb(var(--foreground))]">
                          {plan.price === 0 ? "Free" : `$${plan.price}`}
                        </span>
                        {plan.period && (
                          <span className="text-[rgb(var(--muted-foreground))] mb-1">
                            {plan.period}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[rgb(var(--muted-foreground))] mt-1">
                        {plan.description}
                      </div>
                    </div>

                    <Button
                      variant={plan.highlight ? "default" : "outline"}
                      className="w-full"
                      asChild
                    >
                      <Link href={plan.href}>{plan.cta}</Link>
                    </Button>

                    <ul className="flex flex-col gap-2.5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2.5 text-sm text-[rgb(var(--foreground))]">
                          <CheckCircle2 className="w-4 h-4 text-[rgb(var(--success))] shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-[rgb(var(--muted-foreground))] mt-8">
            <Clock className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Оплата с казахстанских, российских и международных карт Visa / Mastercard
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 bg-[rgb(var(--background))]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-3">FAQ</Badge>
            <h2 className="text-3xl font-bold text-[rgb(var(--foreground))]">
              Часто задаваемые вопросы
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {FAQ.map(({ q, a }) => (
              <Card key={q}>
                <CardContent className="p-5">
                  <h3 className="font-semibold text-[rgb(var(--foreground))] mb-2">{q}</h3>
                  <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed">{a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section
        className="py-24 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgb(var(--primary)) 0%, rgb(108 99 255 / 0.8) 50%, rgb(var(--secondary)) 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 80% 50%, rgb(0 201 167 / 0.3) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Начни прямо сейчас — это бесплатно
          </h2>
          <p className="text-white/80 text-lg mb-8">
            15 минут диагностики и ты знаешь свой текущий уровень и что делать дальше.
          </p>
          <Button
            size="xl"
            className="bg-white text-[rgb(var(--primary))] hover:bg-white/90 shadow-xl"
            asChild
          >
            <Link href="/diagnostic">
              Пройти бесплатную диагностику
              <ChevronRight className="w-5 h-5" />
            </Link>
          </Button>
          <p className="text-white/60 text-sm mt-4">
            Регистрация после диагностики — никаких данных карты
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[rgb(var(--foreground))] text-[rgb(var(--surface-elevated))]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center">
                <span className="text-white font-bold text-sm">EZ</span>
              </div>
              <span className="font-semibold text-white text-lg">ielts</span>
            </div>
            <p className="text-sm leading-relaxed opacity-70 max-w-xs">
              Платформа для подготовки к IELTS с AI-фидбеком и реальными тестами.
              Специально для студентов СНГ.
            </p>
          </div>
          <div>
            <div className="text-white font-medium mb-4 text-sm">Продукт</div>
            <ul className="flex flex-col gap-2 text-sm opacity-70">
              {["Тесты", "AI Writing", "AI Speaking", "Тарифы"].map((l) => (
                <li key={l}>
                  <Link href="#" className="hover:opacity-100 transition-opacity">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-white font-medium mb-4 text-sm">Компания</div>
            <ul className="flex flex-col gap-2 text-sm opacity-70">
              {["О нас", "Блог", "Контакты", "Политика конфиденциальности"].map(
                (l) => (
                  <li key={l}>
                    <Link href="#" className="hover:opacity-100 transition-opacity">
                      {l}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs opacity-50">
            <span>© 2026 EZielts. Все права защищены.</span>
            <span>Алматы, Казахстан</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
