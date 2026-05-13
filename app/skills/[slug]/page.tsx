import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Headphones, PenLine, Mic2,
  CheckCircle2, Sparkles, ChevronRight, BarChart3,
  Clock, Target, Zap, Quote,
} from "lucide-react";

// ─── Skill data ──────────────────────────────────────────────────────────────

const SKILLS = {
  speaking: {
    title: "Speaking",
    tagline: "AI оценка устного ответа за 30 секунд",
    description:
      "Запиши ответ на cue card как на реальном экзамене. Whisper транскрибирует речь, GPT-4 выставит band по всем 4 критериям IELTS и подсветит конкретные слова, которые тянут балл вниз.",
    icon: Mic2,
    color: "amber",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-500",
    accentColor: "from-amber-500 to-orange-500",
    softBg: "bg-amber-50",
    examFormat: "11–14 минут · 3 части",
    parts: [
      { name: "Part 1", desc: "Общие вопросы о себе (4–5 мин)" },
      { name: "Part 2", desc: "Монолог по cue card (3–4 мин)" },
      { name: "Part 3", desc: "Глубокая дискуссия (4–5 мин)" },
    ],
    criteria: [
      "Fluency & Coherence",
      "Lexical Resource",
      "Grammatical Range & Accuracy",
      "Pronunciation",
    ],
    contentCount: "187 топиков",
    quote: "Speaking всегда был моей слабостью — без обратной связи я не понимал что говорю неправильно. AI оценка показала что я перегружаю предложения linking words.",
    quoteAuthor: "Никита, Алматы · 5.5 → 7.0",
    samples: [
      { q: "Describe a time when you helped someone.", part: "Part 2 · Cue card" },
      { q: "Why do people enjoy social media?", part: "Part 3 · Discussion" },
      { q: "Do you prefer mornings or evenings?", part: "Part 1 · Personal" },
    ],
  },
  writing: {
    title: "Writing",
    tagline: "AI-фидбек по 4 критериям IELTS за 20 секунд",
    description:
      "Напиши Task 1 или Task 2 — и получи разбор по официальной шкале IELTS. GPT-4 укажет конкретные ошибки с цитатами из твоего эссе, предложит улучшения и покажет эталонный ответ Band 8.",
    icon: PenLine,
    color: "violet",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-500",
    accentColor: "from-violet-500 to-purple-500",
    softBg: "bg-violet-50",
    examFormat: "60 минут · 2 задания",
    parts: [
      { name: "Task 1 (Academic)", desc: "Графики, диаграммы, карты — 150 слов" },
      { name: "Task 1 (General)", desc: "Письмо (formal/semi/informal) — 150 слов" },
      { name: "Task 2", desc: "Эссе на 250 слов — 40 минут" },
    ],
    criteria: [
      "Task Achievement",
      "Coherence & Cohesion",
      "Lexical Resource",
      "Grammatical Range & Accuracy",
    ],
    contentCount: "310+ заданий",
    quote: "Раньше я платил репетитору 5000₸ за проверку одного эссе. EZielts даёт такой же подробный разбор бесплатно, и я могу писать каждый день вместо раза в неделю.",
    quoteAuthor: "Айгерим, Астана · 6.0 → 7.5",
    samples: [
      { q: "Some say technology makes people lazy. Discuss both views and give your opinion.", part: "Task 2 · Opinion" },
      { q: "The chart shows population growth in 4 countries from 1950 to 2020. Summarise.", part: "Task 1 · Academic" },
      { q: "Write a letter to your manager requesting time off.", part: "Task 1 · General" },
    ],
  },
  listening: {
    title: "Listening",
    tagline: "Реальные аудио-тесты Cambridge-уровня",
    description:
      "38 полных тестов с настоящими аудио-записями британских и австралийских спикеров. Как на экзамене — аудио играет один раз, перемотка недоступна. После — мгновенный разбор по типам вопросов.",
    icon: Headphones,
    color: "emerald",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-500",
    accentColor: "from-emerald-500 to-teal-500",
    softBg: "bg-emerald-50",
    examFormat: "30 минут · 40 вопросов",
    parts: [
      { name: "Section 1", desc: "Социальный диалог (бронирование, заявка)" },
      { name: "Section 2", desc: "Монолог в общественном контексте" },
      { name: "Section 3", desc: "Академический диалог (студент + тьютор)" },
      { name: "Section 4", desc: "Академическая лекция" },
    ],
    criteria: [
      "Multiple Choice",
      "Form/Note/Table Completion",
      "Sentence Completion",
      "Matching",
    ],
    contentCount: "38 тестов · 152 секции",
    quote: "Аудио в EZielts реально как на экзамене — разные акценты, естественная скорость. После 10 тестов перестал теряться на Section 4.",
    quoteAuthor: "Дамир, Бишкек · 6.0 → 7.5",
    samples: [
      { q: "Booking a hotel room — fill in the form", part: "Section 1" },
      { q: "University library orientation tour", part: "Section 2" },
      { q: "Climate change lecture — note completion", part: "Section 4" },
    ],
  },
  reading: {
    title: "Reading",
    tagline: "750+ Cambridge-style тестов с разбором ошибок",
    description:
      "Каждый текст — оригинальный отрывок Academic или General Training уровня. После теста AI группирует ошибки по типам вопросов (True/False/NG, Matching Headings, MCQ) и даёт точечные рекомендации.",
    icon: BookOpen,
    color: "blue",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-500",
    accentColor: "from-blue-500 to-sky-500",
    softBg: "bg-blue-50",
    examFormat: "60 минут · 40 вопросов",
    parts: [
      { name: "Passage 1", desc: "Лёгкий текст (700–900 слов)" },
      { name: "Passage 2", desc: "Средний (800–1000 слов)" },
      { name: "Passage 3", desc: "Сложный академический (900–1100 слов)" },
    ],
    criteria: [
      "True / False / Not Given",
      "Matching Headings",
      "Multiple Choice",
      "Sentence Completion",
    ],
    contentCount: "750+ тестов · 30 вопросов в каждом",
    quote: "Раньше я делал True/False/NG наугад — половина мимо. Анализ ошибок EZielts показал паттерн: я путал FALSE и NOT GIVEN. Подтянул за неделю.",
    quoteAuthor: "Мадина, Шымкент · 6.0 → 7.5",
    samples: [
      { q: "The Origins of the Solar System — Academic", part: "Passage 3" },
      { q: "How Coffee Changed the World — Academic", part: "Passage 2" },
      { q: "Renting an apartment in London — General", part: "Passage 1" },
    ],
  },
} as const;

type SkillKey = keyof typeof SKILLS;

export function generateStaticParams() {
  return Object.keys(SKILLS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const skill = SKILLS[slug as SkillKey];
  if (!skill) return {};
  return {
    title: `${skill.title} — IELTS подготовка с AI | EZielts`,
    description: skill.tagline,
  };
}

export default async function SkillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const skill = SKILLS[slug as SkillKey];
  if (!skill) notFound();

  const Icon = skill.icon;
  const otherSkills = (Object.entries(SKILLS) as [SkillKey, typeof SKILLS[SkillKey]][])
    .filter(([k]) => k !== slug);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-20 overflow-hidden bg-gradient-to-b from-[rgb(var(--surface))] to-[rgb(var(--background))]">
        <div
          aria-hidden
          className={`pointer-events-none absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.08] bg-gradient-to-br ${skill.accentColor}`}
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <div className={`w-20 h-20 rounded-2xl ${skill.iconBg} flex items-center justify-center mb-6 ring-1 ring-inset ring-[rgb(var(--border))]`}>
              <Icon className={`w-10 h-10 ${skill.iconColor}`} strokeWidth={2} />
            </div>

            <Badge variant="secondary" className="mb-4">{skill.examFormat}</Badge>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight text-[rgb(var(--foreground))] mb-5">
              IELTS{" "}
              <span className={`bg-gradient-to-r ${skill.accentColor} bg-clip-text text-transparent`}>
                {skill.title}
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-[rgb(var(--muted-foreground))] leading-relaxed mb-8 max-w-2xl">
              {skill.tagline}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 bg-[rgb(var(--primary))] hover:bg-[rgb(var(--primary)/0.92)] text-white font-semibold px-7 py-4 rounded-xl transition-colors shadow-lg shadow-[rgb(var(--primary)/0.25)]"
              >
                Попробовать бесплатно
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                href={`/tests/${slug}`}
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[rgb(var(--muted)/0.05)] border border-[rgb(var(--border))] text-[rgb(var(--foreground))] font-semibold px-7 py-4 rounded-xl transition-colors"
              >
                Открыть тест
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-5 mt-8 text-sm text-[rgb(var(--muted-foreground))]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[rgb(var(--success))]" />
                Без регистрации
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[rgb(var(--success))]" />
                {skill.contentCount}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[rgb(var(--success))]" />
                AI-фидбек
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 bg-[rgb(var(--surface))] border-y border-[rgb(var(--border))]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <Badge variant="default" className="mb-3">Как это работает</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-[rgb(var(--foreground))]">
              4 шага до результата
            </h2>
          </div>

          <div className="grid md:grid-cols-4 gap-5">
            {[
              { n: "01", icon: Target, title: "Выбери тест", desc: `Открой ${skill.title.toLowerCase()} — мы автоматически подберём задание по уровню.` },
              { n: "02", icon: Clock, title: "Пройди как на экзамене", desc: `${skill.examFormat}. Таймер, реальный формат, без подсказок.` },
              { n: "03", icon: Sparkles, title: "Получи AI-разбор", desc: "GPT-4 оценит ответ по 4 критериям IELTS и подсветит ошибки." },
              { n: "04", icon: BarChart3, title: "Отслеживай прогресс", desc: "Вижу как растёт band по неделям. AI план учит на слабых местах." },
            ].map((step) => (
              <div key={step.n} className="relative bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-2xl p-5">
                <div className="absolute top-4 right-4 text-2xl font-bold text-[rgb(var(--muted))]/30">{step.n}</div>
                <div className={`w-10 h-10 rounded-lg ${skill.iconBg} flex items-center justify-center mb-3`}>
                  <step.icon className={`w-5 h-5 ${skill.iconColor}`} />
                </div>
                <h3 className="font-semibold text-[rgb(var(--foreground))] mb-1.5 text-[15px]">{step.title}</h3>
                <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EXAM STRUCTURE ── */}
      <section className="py-20 bg-[rgb(var(--background))]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-3">Формат экзамена</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-[rgb(var(--foreground))] mb-4 leading-tight">
                Что входит в {skill.title}?
              </h2>
              <p className="text-base text-[rgb(var(--muted-foreground))] leading-relaxed mb-6">
                {skill.description}
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 text-[rgb(var(--primary))] font-semibold hover:underline"
              >
                Начать практику
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              {skill.parts.map((p, i) => (
                <div key={i} className={`flex items-start gap-4 p-5 rounded-2xl ${skill.softBg} border border-[rgb(var(--border))]`}>
                  <div className={`w-10 h-10 rounded-lg bg-white flex items-center justify-center font-mono font-bold text-sm shrink-0 ${skill.iconColor}`}>
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-[rgb(var(--foreground))] mb-0.5">{p.name}</div>
                    <p className="text-sm text-[rgb(var(--muted-foreground))]">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SAMPLE QUESTIONS ── */}
      <section className="py-20 bg-[rgb(var(--surface))] border-y border-[rgb(var(--border))]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <Badge variant="default" className="mb-3">Примеры заданий</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-[rgb(var(--foreground))] mb-3">
              Что тебя ждёт внутри
            </h2>
            <p className="text-[rgb(var(--muted-foreground))]">
              {skill.contentCount} в базе. Каждый — настоящее экзаменационное задание.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {skill.samples.map((s, i) => (
              <div key={i} className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-2xl p-6 flex flex-col gap-3 hover:border-[rgb(var(--primary)/0.3)] hover:shadow-lg transition-all">
                <Badge variant="outline" className="self-start text-[10px]">{s.part}</Badge>
                <p className="font-mono text-[15px] text-[rgb(var(--foreground))] italic leading-relaxed flex-1">
                  &ldquo;{s.q}&rdquo;
                </p>
                <div className="flex items-center gap-1.5 text-sm text-[rgb(var(--primary))] font-medium">
                  <Zap className="w-3.5 h-3.5" />
                  AI разбор после ответа
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CRITERIA ── */}
      <section className="py-20 bg-[rgb(var(--background))]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <Badge variant="success" className="mb-3">AI-оценка</Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-[rgb(var(--foreground))] mb-4">
            Что мы оцениваем
          </h2>
          <p className="text-[rgb(var(--muted-foreground))] mb-10 max-w-2xl mx-auto leading-relaxed">
            Используем официальную IELTS band descriptors. GPT-4 разбирает ответ
            по тем же критериям, что реальный экзаменатор.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            {skill.criteria.map((c, i) => (
              <div key={i} className={`flex items-center gap-4 p-5 rounded-xl bg-[rgb(var(--surface))] border border-[rgb(var(--border))] text-left`}>
                <div className={`w-10 h-10 rounded-lg ${skill.iconBg} flex items-center justify-center shrink-0`}>
                  <CheckCircle2 className={`w-5 h-5 ${skill.iconColor}`} />
                </div>
                <span className="font-medium text-[rgb(var(--foreground))]">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section className="py-20 bg-[rgb(var(--surface))] border-y border-[rgb(var(--border))]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <Quote className={`w-10 h-10 ${skill.iconColor} mx-auto mb-6 opacity-60`} />
          <blockquote className="text-xl sm:text-2xl text-[rgb(var(--foreground))] leading-relaxed font-medium mb-6">
            &ldquo;{skill.quote}&rdquo;
          </blockquote>
          <div className="text-sm text-[rgb(var(--muted-foreground))]">
            {skill.quoteAuthor}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className={`py-20 bg-gradient-to-br ${skill.accentColor}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            Готов попробовать {skill.title}?
          </h2>
          <p className="text-base sm:text-lg text-white/90 mb-8 max-w-xl mx-auto leading-relaxed">
            Регистрация занимает 30 секунд. Без карты, без обязательств — сразу
            доступ к {skill.contentCount.toLowerCase()} и AI-фидбеку.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-white text-[rgb(var(--foreground))] font-semibold px-7 py-4 rounded-xl hover:bg-white/95 transition-colors shadow-xl"
            >
              Начать бесплатно
              <ChevronRight className="w-5 h-5" />
            </Link>
            <Link
              href="/diagnostic"
              className="inline-flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/30 text-white font-semibold px-7 py-4 rounded-xl transition-colors"
            >
              Пройти 15-мин диагностику
            </Link>
          </div>
        </div>
      </section>

      {/* ── OTHER SKILLS ── */}
      <section className="py-16 bg-[rgb(var(--background))]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-6 text-center">
            Другие модули
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {otherSkills.map(([key, s]) => {
              const OtherIcon = s.icon;
              return (
                <Link
                  key={key}
                  href={`/skills/${key}`}
                  className="group flex items-center gap-3 p-4 rounded-xl bg-[rgb(var(--surface))] border border-[rgb(var(--border))] hover:border-[rgb(var(--primary)/0.3)] hover:shadow-md transition-all"
                >
                  <div className={`w-10 h-10 rounded-lg ${s.iconBg} flex items-center justify-center shrink-0`}>
                    <OtherIcon className={`w-5 h-5 ${s.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[rgb(var(--foreground))] text-sm">{s.title}</div>
                    <div className="text-xs text-[rgb(var(--muted-foreground))] truncate">{s.contentCount}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[rgb(var(--muted))] group-hover:text-[rgb(var(--foreground))] group-hover:translate-x-0.5 transition-all" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
