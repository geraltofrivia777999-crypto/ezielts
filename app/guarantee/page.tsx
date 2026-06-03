import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WHATSAPP_CONTACT_URL, WHATSAPP_CTA_LABEL } from "@/lib/contact";
import {
  Check,
  ChevronLeft,
  ClipboardCheck,
  FileCheck2,
  Mail,
  MessageCircle,
  Shield,
  Sparkles,
} from "lucide-react";

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Предоставьте начальный балл",
    text: "Загрузите официальный действующий сертификат IELTS (TRF) в течение первых 7 дней после регистрации.",
  },
  {
    step: "2",
    title: "Практикуйтесь с ИИ",
    text: "Следуйте учебному плану, выполняйте Success Checklist, проходите пробные экзамены и используйте AI-фидбек.",
  },
  {
    step: "3",
    title: "Сдайте официальный тест",
    text: "Сдайте IELTS в течение 60 дней после окончания срока действия подписки и отправьте новый сертификат.",
  },
];

const REQUIREMENTS = [
  {
    title: "Начальный балл",
    text: "Официальный сертификат IELTS с Overall Band Score 6.5 или ниже, полученный в течение 3 месяцев до приобретения подписки. Загрузить в течение первых 7 дней.",
  },
  {
    title: "Период подписки",
    text: "Непрерывная оплаченная подписка минимум 3 месяца (90 дней). Гарантия действует для тарифов 3 месяца и 12 месяцев.",
  },
  {
    title: "Success Checklist",
    text: "Выполнить все задания из раздела Success Checklist на платформе.",
  },
  {
    title: "Пробные экзамены",
    text: "Не менее 12 пробных экзаменов по каждой секции: 12 Listening, 12 Reading, 12 Writing, 12 Speaking.",
  },
  {
    title: "AI-фидбек",
    text: "Минимум 30 заданий Writing и 30 сессий Speaking с оценкой ИИ.",
  },
  {
    title: "Личное использование",
    text: "Аккаунт должен использоваться исключительно зарегистрированным студентом.",
  },
];

const TIMELINE = [
  {
    title: "Первичная подача",
    text: "Ваш первый сертификат IELTS (TRF) нужно загрузить в течение 7 дней с момента регистрации.",
  },
  {
    title: "Повторный тест",
    text: "Официальный экзамен IELTS нужно сдать в течение 60 дней после окончания подписки.",
  },
  {
    title: "Заявка на возврат",
    text: "Подайте заявку в течение 30 дней после даты официального экзамена.",
  },
];

const TERMS = [
  "Мы оставляем за собой право отклонить заявку, если логи активности указывают на фиктивное прохождение: например, завершение секции Reading за 5 минут или отправка пустых Writing-заданий.",
  "Гарантия распространяется только на первый официальный экзамен IELTS, сданный после завершения программы.",
  "Возврат ограничен стоимостью подписки. Он не покрывает стоимость официального экзамена, транспортные расходы или услуги сторонних репетиторов.",
  "Мы используем аналитику активности для верификации личного использования. Подозрительная активность или одновременные входы из разных локаций аннулируют право на возврат.",
];

const FAQ = [
  {
    q: "Какое именно повышение балла гарантируется?",
    a: "Увеличение Overall Band Score минимум на 1.0 балл: например, с 5.5 до 6.5.",
  },
  {
    q: "Считается ли пробный тест с другого сайта?",
    a: "Нет. Для гарантии нужно использовать нашу систему тестирования, потому что мы отслеживаем прогресс, вовлечённость и качество подготовки.",
  },
  {
    q: "Почему начальный балл ограничен 6.5?",
    a: "Рост с 7.5 до 8.5 сложнее и зависит от тонких нюансов языка. Гарантия рассчитана на студентов, которым нужен существенный скачок в балле.",
  },
  {
    q: "Что если мне нужно подтянуть только Speaking?",
    a: "Гарантия привязана к Overall Band Score. Платформа помогает улучшать отдельные секции, но возврат зависит от общего результата.",
  },
];

function RequirementCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-white p-5 shadow-sm">
      <div className="flex gap-4">
        <div className="mt-1 h-auto w-1.5 rounded-full bg-emerald-500" />
        <p className="text-base leading-7 text-[rgb(var(--muted-foreground))]">
          <strong className="font-bold text-[rgb(var(--foreground))]">{title}:</strong> {text}
        </p>
      </div>
    </div>
  );
}

export default function GuaranteePage() {
  return (
    <div className="min-h-screen bg-[rgb(var(--background))]">
      <header className="sticky top-0 z-40 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/pricing" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
            <ChevronLeft className="h-4 w-4" />
            Тарифы
          </Link>
          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[rgb(var(--primary))]">
              <span className="text-xs font-bold text-white">EZ</span>
            </div>
            <span className="font-semibold text-[rgb(var(--foreground))]">ielts</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-16 px-4 py-14">
        <section className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Shield className="h-10 w-10" />
          </div>
          <Badge variant="success" className="mb-4">Для тарифов 3 и 12 месяцев</Badge>
          <h1 className="text-4xl font-black tracking-normal text-[rgb(var(--foreground))] md:text-5xl">
            Гарантия повышения балла IELTS
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[rgb(var(--muted-foreground))]">
            Мы заинтересованы в вашем результате. Если вы следуете программе, выполняете требования и Overall Band Score не растёт минимум на 1.0 балл, мы возвращаем стоимость подписки.
          </p>
        </section>

        <section>
          <h2 className="text-3xl font-black tracking-normal text-[rgb(var(--foreground))]">Как это работает</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-[rgb(var(--muted-foreground))]">
            Гарантия работает только при прозрачном начальном результате, регулярной работе на платформе и официальном повторном экзамене.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="rounded-2xl border border-[rgb(var(--border))] bg-white p-6 shadow-sm">
                <div className="text-3xl font-black text-emerald-600">{item.step}</div>
                <h3 className="mt-5 text-xl font-bold text-[rgb(var(--foreground))]">{item.title}</h3>
                <p className="mt-3 text-base leading-7 text-[rgb(var(--muted-foreground))]">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-black tracking-normal text-[rgb(var(--foreground))]">Требования к участникам</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-[rgb(var(--muted-foreground))]">
            Чтобы гарантией могли воспользоваться только студенты, которые действительно готовятся к результату, должны быть соблюдены условия:
          </p>
          <div className="mt-7 flex flex-col gap-4">
            {REQUIREMENTS.map((item) => (
              <RequirementCard key={item.title} title={item.title} text={item.text} />
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <h2 className="text-3xl font-black tracking-normal text-[rgb(var(--foreground))]">Подача заявки и сроки</h2>
            <ul className="mt-6 flex flex-col gap-5">
              {TIMELINE.map((item) => (
                <li key={item.title} className="flex gap-4">
                  <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-base leading-7 text-[rgb(var(--muted-foreground))]">
                    <strong className="font-bold text-[rgb(var(--foreground))]">{item.title}:</strong> {item.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[rgb(var(--border))] bg-white p-6 shadow-sm">
            <div className="flex gap-4">
              <Mail className="mt-1 h-6 w-6 shrink-0 text-[rgb(var(--muted-foreground))]" />
              <div>
                <h3 className="text-xl font-bold text-[rgb(var(--foreground))]">Как отправить заявку</h3>
                <p className="mt-3 text-base leading-7 text-[rgb(var(--foreground))]">
                  Напишите на <strong>support@ezielts.com</strong> с темой: “Заявка на возврат по гарантии IELTS — [Ваше имя]”.
                </p>
                <p className="mt-4 text-base leading-7 text-[rgb(var(--muted-foreground))]">
                  Приложите полное имя, email аккаунта и PDF-копии обоих сертификатов IELTS: начального и нового. Проверка занимает 7–10 рабочих дней.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-black tracking-normal text-[rgb(var(--foreground))]">Общие положения и условия</h2>
          <div className="mt-6 rounded-2xl border border-[rgb(var(--border))] bg-white p-6 shadow-sm">
            <ul className="flex flex-col gap-5">
              {TERMS.map((term) => (
                <li key={term} className="flex gap-4 text-base leading-7 text-[rgb(var(--muted-foreground))]">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--muted-foreground))]" />
                  {term}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-black tracking-normal text-[rgb(var(--foreground))]">Часто задаваемые вопросы</h2>
          <div className="mt-7 flex flex-col gap-4">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-2xl border border-[rgb(var(--border))] bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold text-[rgb(var(--foreground))]">{item.q}</h3>
                <p className="mt-3 text-base leading-7 text-[rgb(var(--muted-foreground))]">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <FileCheck2 className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[rgb(var(--foreground))]">Готовы готовиться по программе?</h2>
            <p className="mt-1 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
              Выберите тариф на 3 или 12 месяцев, чтобы открыть условия гарантии и системную подготовку.
            </p>
          </div>
          <Button asChild className="rounded-xl">
            <a href={WHATSAPP_CONTACT_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              {WHATSAPP_CTA_LABEL}
            </a>
          </Button>
        </section>

        <section className="grid gap-4 rounded-2xl border border-[rgb(var(--border))] bg-white p-6 shadow-sm md:grid-cols-[auto_1fr]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--primary))]">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[rgb(var(--primary))]" />
              <h2 className="text-lg font-bold text-[rgb(var(--foreground))]">Success Checklist</h2>
            </div>
            <p className="text-sm leading-6 text-[rgb(var(--muted-foreground))]">
              Чеклист будет использоваться как основной источник подтверждения активности: тесты, AI-разборы, mock-экзамены и регулярность занятий должны быть выполнены внутри платформы EZielts.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
