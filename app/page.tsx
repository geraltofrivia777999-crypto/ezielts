import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/layout/navbar";
import { PaymentChoiceButton } from "@/components/payment/payment-choice-button";
import { PRICING_PLANS } from "@/lib/plans";
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
  ChevronDown,
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

// ─── Interactive FAQ item ────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group" name="faq">
      <summary className="flex items-center justify-between cursor-pointer list-none p-5 [&::-webkit-details-marker]:hidden">
        <h3 className="font-semibold text-[rgb(var(--foreground))] pr-4">{q}</h3>
        <ChevronDown className="w-5 h-5 text-[rgb(var(--muted-foreground))] shrink-0 transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5 -mt-1">
        <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed">{a}</p>
      </div>
    </details>
  );
}

// ─── Skill card for hero ─────────────────────────────────────────────────────

function SkillCard({
  icon: Icon,
  title,
  subtitle,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="group bg-white rounded-2xl p-6 sm:p-7 flex flex-col items-center text-center shadow-xl shadow-black/10 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300">
      <div className={`w-14 h-14 rounded-xl ${iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className={`w-7 h-7 ${iconColor}`} strokeWidth={2} />
      </div>
      <h3 className="font-bold text-[rgb(var(--foreground))] text-base mb-1">{title}</h3>
      <p className="text-xs text-[rgb(var(--muted-foreground))]">{subtitle}</p>
    </div>
  );
}

function FreeOfferCard({
  icon: Icon,
  title,
  subtitle,
  iconBg,
  iconColor,
  iconRing,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  iconBg: string;
  iconColor: string;
  iconRing: string;
}) {
  return (
    <div className="group relative bg-white rounded-2xl p-5 sm:p-6 flex flex-col shadow-[0_2px_12px_-4px_rgba(15,15,40,0.08)] hover:shadow-[0_12px_32px_-8px_rgba(108,99,255,0.18)] hover:-translate-y-0.5 transition-all duration-300 border border-[rgba(108,99,255,0.06)]">
      <div className={`w-12 h-12 rounded-xl ${iconBg} ${iconRing} flex items-center justify-center mb-4 ring-1 ring-inset transition-transform duration-300 group-hover:scale-105`}>
        <Icon className={`w-[22px] h-[22px] ${iconColor}`} strokeWidth={2.25} />
      </div>
      <h3 className="font-bold text-[rgb(var(--foreground))] text-[15px] mb-1 tracking-tight">{title}</h3>
      <p className="text-[13px] text-[rgb(var(--muted-foreground))] leading-snug">{subtitle}</p>
    </div>
  );
}

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
      <section className="relative overflow-hidden bg-[#3B1E91]">
        {/* Subtle gradient orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #6C63FF 0%, transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #8B7CF6 0%, transparent 70%)" }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-20 md:pt-32 md:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: copy */}
            <div className="text-white">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight mb-6 animate-slide-up">
                Сдай IELTS на{" "}
                <span className="block sm:inline text-[#B8A9FF]">нужный балл</span>{" "}
                <span className="block sm:inline">с первого раза</span>
              </h1>

              <p className="text-lg sm:text-xl text-white/80 leading-relaxed mb-8 max-w-lg animate-slide-up delay-200">
                Достигни цели с моментальной точной оценкой и персональным
                отслеживанием прогресса.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10 animate-slide-up delay-300">
                <Link
                  href="/diagnostic"
                  className="group inline-flex items-center justify-center gap-2 bg-white text-[#3B1E91] font-semibold text-base px-7 py-4 rounded-xl hover:bg-white/95 transition-all shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-black/20 hover:-translate-y-0.5 active:translate-y-0"
                >
                  Узнай свой балл бесплатно
                  <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              {/* Trust card */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 max-w-md animate-fade-in delay-500">
                <div className="grid grid-cols-2 gap-y-2 gap-x-6 mb-3">
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B8A9FF]" />
                    98% точность
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B8A9FF]" />
                    Реальные экзамены
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B8A9FF]" />
                    Тысячи студентов
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B8A9FF]" />
                    AI оценка Speaking
                  </div>
                </div>
                <div className="text-white font-semibold text-sm mb-1">
                  EZielts AI Score = Real IELTS Score
                </div>
                <p className="text-xs text-white/70 leading-relaxed">
                  Используем данные реальных экзаменов чтобы дать тебе тот же балл,
                  что ты получишь на тесте.
                </p>
              </div>
            </div>

            {/* Right: 4 skill cards */}
            <div className="grid grid-cols-2 gap-4 sm:gap-5 stagger-children">
              <SkillCard icon={Mic2} title="Speaking" subtitle="2 бесплатных оценки в день" iconBg="bg-amber-100" iconColor="text-amber-500" />
              <SkillCard icon={PenLine} title="Writing" subtitle="2 бесплатных оценки в день" iconBg="bg-violet-100" iconColor="text-violet-500" />
              <SkillCard icon={Headphones} title="Listening" subtitle="Вопросы уровня Cambridge" iconBg="bg-green-100" iconColor="text-green-500" />
              <SkillCard icon={BookOpen} title="Reading" subtitle="Вопросы уровня Cambridge" iconBg="bg-blue-100" iconColor="text-blue-500" />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 stagger-children">
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

          <div className="grid md:grid-cols-3 gap-8 stagger-children">
            {[
              {
                step: "01",
                title: "Диагностика",
                desc: "15-минутный тест без регистрации. Reading + Listening + Grammar. Сразу видишь свои слабые места.",
                gradient: "from-violet-500 to-indigo-600",
              },
              {
                step: "02",
                title: "Практика",
                desc: "Каждый день новые тесты из огромного банка. Алгоритм подбирает задания по слабым типам вопросов.",
                gradient: "from-indigo-500 to-blue-600",
              },
              {
                step: "03",
                title: "AI-фидбек",
                desc: "Отправляешь Writing/Speaking — получаешь оценку по всем критериям IELTS с конкретными улучшениями.",
                gradient: "from-blue-500 to-teal-500",
              },
            ].map(({ step, title, desc, gradient }) => (
              <div key={step} className="relative group">
                {/* Step connector line (desktop) */}
                <div className="hidden md:block absolute top-5 left-full w-full h-px bg-[rgb(var(--border))] -translate-x-1/2 last:hidden" />
                <div className="flex flex-col gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-sm font-mono font-bold text-white shadow-lg shadow-violet-500/20 group-hover:scale-110 transition-transform duration-300`}
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

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <Card
                key={title}
                className="group card-interactive"
              >
                <CardContent className="p-6 flex flex-col gap-4">
                  <div className="w-11 h-11 rounded-xl bg-[rgb(var(--primary)/0.1)] flex items-center justify-center group-hover:bg-[rgb(var(--primary))] transition-colors duration-300">
                    <Icon className="w-5 h-5 text-[rgb(var(--primary))] group-hover:text-white transition-colors duration-300" />
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

      {/* ── FREE OFFER BLOCK ── */}
      <section className="py-20 bg-[rgb(var(--background))]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="relative rounded-[28px] bg-gradient-to-br from-violet-50/80 via-white to-indigo-50/60 border border-violet-100/70 p-8 md:p-14 overflow-hidden shadow-[0_4px_24px_-12px_rgba(108,99,255,0.15)]">
            {/* Decorative blob */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-24 w-[400px] h-[400px] rounded-full opacity-40"
              style={{ background: "radial-gradient(circle, rgba(184,169,255,0.4) 0%, transparent 70%)" }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full opacity-30"
              style={{ background: "radial-gradient(circle, rgba(108,99,255,0.25) 0%, transparent 70%)" }}
            />

            <div className="relative grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
              {/* Left: copy */}
              <div>
                <div className="text-xs font-bold tracking-widest text-[rgb(var(--primary))] mb-4">
                  БЕСПЛАТНО — БЕЗ КАРТЫ
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-[rgb(var(--foreground))] leading-tight mb-4">
                  Не готов платить?{" "}
                  <br className="hidden md:block" />
                  Начни бесплатно.
                </h2>
                <p className="text-base md:text-lg text-[rgb(var(--muted-foreground))] leading-relaxed mb-8">
                  Один бесплатный тест в день, 15-минутная диагностика без регистрации,
                  а AI-разборы и прогресс открываются в Pro.
                  Никаких скрытых платежей.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 bg-[rgb(var(--primary))] text-white font-semibold text-base px-7 py-4 rounded-xl hover:bg-[rgb(var(--primary)/0.92)] transition-colors shadow-lg shadow-[rgb(var(--primary)/0.25)]"
                >
                  Начать бесплатно
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>

              {/* Right: 6 feature cards (2x3) */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <FreeOfferCard
                  icon={BookOpen}
                  title="Reading"
                  subtitle="1 бесплатный тест в день"
                  iconBg="bg-gradient-to-br from-blue-50 to-blue-100"
                  iconColor="text-blue-600"
                  iconRing="ring-blue-200/60"
                />
                <FreeOfferCard
                  icon={Headphones}
                  title="Listening"
                  subtitle="Аудио уровня Cambridge"
                  iconBg="bg-gradient-to-br from-emerald-50 to-emerald-100"
                  iconColor="text-emerald-600"
                  iconRing="ring-emerald-200/60"
                />
                <FreeOfferCard
                  icon={PenLine}
                  title="Writing"
                  subtitle="AI-фидбек по 4 критериям"
                  iconBg="bg-gradient-to-br from-violet-50 to-violet-100"
                  iconColor="text-violet-600"
                  iconRing="ring-violet-200/60"
                />
                <FreeOfferCard
                  icon={Mic2}
                  title="Speaking"
                  subtitle="AI оценка + транскрипт"
                  iconBg="bg-gradient-to-br from-amber-50 to-amber-100"
                  iconColor="text-amber-600"
                  iconRing="ring-amber-200/60"
                />
                <FreeOfferCard
                  icon={Zap}
                  title="Диагностика"
                  subtitle="15 минут без регистрации"
                  iconBg="bg-gradient-to-br from-pink-50 to-pink-100"
                  iconColor="text-pink-600"
                  iconRing="ring-pink-200/60"
                />
                <FreeOfferCard
                  icon={Star}
                  title="AI Tutor"
                  subtitle="Доступен в Pro"
                  iconBg="bg-gradient-to-br from-teal-50 to-teal-100"
                  iconColor="text-teal-600"
                  iconRing="ring-teal-200/60"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TELEGRAM CTA ── */}
      <section className="bg-gradient-to-r from-[#241682] via-[#2d1a9e] to-[#241682] py-10 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(34,158,217,0.15),transparent_60%)]" aria-hidden />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-2 leading-tight">
            Присоединяйся к ученикам, которые уже растут.
          </h2>
          <p className="text-sm text-white/70 mb-5 max-w-xl mx-auto leading-relaxed">
            Ежедневные подсказки, разборы вопросов и истории как другие идут от{" "}
            <span className="font-mono">6.5 → 8.0</span>.
          </p>
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 bg-[#229ED9] hover:bg-[#1d8cc0] text-white font-semibold text-sm px-5 py-2.5 rounded-full transition-all shadow-md shadow-[#229ED9]/30 hover:shadow-lg hover:shadow-[#229ED9]/40 hover:-translate-y-0.5 active:translate-y-0"
          >
            <svg className="w-4 h-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
            </svg>
            Вступить в Telegram
          </a>
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

          <div className="grid md:grid-cols-3 gap-6 stagger-children">
            {TESTIMONIALS.map(({ name, city, before, after, text }) => (
              <Card key={name} className="flex flex-col gap-0 card-interactive">
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
              1 месяц, 3 месяца или 12 месяцев — выбери срок подготовки
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 pt-5 max-w-4xl mx-auto">
            {PRICING_PLANS.map((plan) => (
              <div key={plan.name} className={plan.badge ? "relative z-10" : "relative"}>
                {plan.badge && (
                  <div
                    className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap shadow-md"
                    style={{ background: "rgb(var(--secondary))" }}
                  >
                    {plan.badge}
                  </div>
                )}
                <Card
                  className={
                    plan.accent === "blue"
                      ? "border-[rgb(var(--primary))] shadow-lg shadow-[rgb(var(--primary)/0.12)] relative"
                      : ""
                  }
                >
                  {plan.accent === "blue" && (
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
                        {plan.eyebrow}
                      </div>
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-bold text-[rgb(var(--foreground))]">
                          ${plan.price}
                        </span>
                        <span className="text-[rgb(var(--muted-foreground))] mb-1">
                          {plan.name}
                        </span>
                      </div>
                      <div className="text-sm text-[rgb(var(--muted-foreground))] mt-1">
                        {plan.monthlyLabel ?? plan.periodLabel}
                      </div>
                    </div>

                    <PaymentChoiceButton
                      variant={plan.accent === "blue" ? "default" : "outline"}
                      className="w-full"
                    />

                    <ul className="flex flex-col gap-2.5">
                      {plan.included.slice(0, 5).map((f) => (
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

          <div className="flex flex-col gap-3">
            {FAQ.map(({ q, a }) => (
              <Card key={q} className="overflow-hidden transition-shadow hover:shadow-md">
                <FaqItem q={q} a={a} />
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
          <div className="relative inline-block">
            <div className="absolute -inset-1 bg-white/30 rounded-2xl blur-md animate-pulse" />
            <Button
              size="xl"
              className="relative bg-white text-[rgb(var(--primary))] hover:bg-white/90 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
              asChild
            >
              <Link href="/diagnostic">
                Пройти бесплатную диагностику
                <ChevronRight className="w-5 h-5" />
              </Link>
            </Button>
          </div>
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
                  <Link href="#" className="hover:opacity-100 hover:translate-x-0.5 transition-all inline-block">
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
                    <Link href="#" className="hover:opacity-100 hover:translate-x-0.5 transition-all inline-block">
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
