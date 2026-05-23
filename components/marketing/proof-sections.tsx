"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

const CERTIFICATES = [
  {
    src: "/proof/ielts-certificate-1.jpg",
    alt: "IELTS retake certificate with 7.5 overall band score",
    label: "Retake 7.5",
  },
  {
    src: "/proof/ielts-certificate-2.png",
    alt: "IELTS certificate with 7.5 overall band score",
    label: "Overall 7.5",
  },
];

const UNIVERSITY_LOGOS = [
  {
    name: "Harvard University",
    wordmark: "HARVARD",
    submark: "UNIVERSITY",
    monogram: "H",
    markClassName: "border-[#A51C30]/25 bg-[#A51C30]/10 text-[#A51C30]",
    wordmarkClassName: "text-[#A51C30]",
  },
  {
    name: "Stanford University",
    wordmark: "Stanford",
    submark: "UNIVERSITY",
    monogram: "S",
    markClassName: "border-[#8C1515]/25 bg-[#8C1515]/10 text-[#8C1515]",
    wordmarkClassName: "text-[#8C1515]",
  },
  {
    name: "Yale University",
    wordmark: "YALE",
    submark: "UNIVERSITY",
    monogram: "Y",
    markClassName: "border-[#00356B]/25 bg-[#00356B]/10 text-[#00356B]",
    wordmarkClassName: "text-[#00356B]",
  },
  {
    name: "Princeton University",
    wordmark: "PRINCETON",
    submark: "UNIVERSITY",
    monogram: "P",
    markClassName: "border-[#E77500]/30 bg-[#E77500]/10 text-[#E77500]",
    wordmarkClassName: "text-[#E77500]",
  },
  {
    name: "University of Pennsylvania",
    wordmark: "Penn",
    submark: "UNIVERSITY OF PENNSYLVANIA",
    monogram: "P",
    markClassName: "border-[#011F5B]/25 bg-[#011F5B]/10 text-[#011F5B]",
    wordmarkClassName: "text-[#011F5B]",
  },
  {
    name: "Cornell University",
    wordmark: "Cornell",
    submark: "UNIVERSITY",
    monogram: "C",
    markClassName: "border-[#B31B1B]/25 bg-[#B31B1B]/10 text-[#B31B1B]",
    wordmarkClassName: "text-[#B31B1B]",
  },
  {
    name: "Brown University",
    wordmark: "BROWN",
    submark: "UNIVERSITY",
    monogram: "B",
    markClassName: "border-[#4E3629]/25 bg-[#4E3629]/10 text-[#4E3629]",
    wordmarkClassName: "text-[#4E3629]",
  },
  {
    name: "University of Texas",
    wordmark: "TEXAS",
    submark: "UNIVERSITY OF TEXAS",
    monogram: "T",
    markClassName: "border-[#BF5700]/25 bg-[#BF5700]/10 text-[#BF5700]",
    wordmarkClassName: "text-[#BF5700]",
  },
  {
    name: "Université Paris Cité",
    wordmark: "Université",
    submark: "PARIS CITE",
    monogram: "UP",
    markClassName: "border-[#D0002A]/25 bg-[#D0002A]/10 text-[#D0002A]",
    wordmarkClassName: "text-[#D0002A]",
  },
  {
    name: "St George's University",
    wordmark: "St George's",
    submark: "UNIVERSITY",
    monogram: "SG",
    markClassName: "border-[#C8102E]/25 bg-[#C8102E]/10 text-[#C8102E]",
    wordmarkClassName: "text-[#C8102E]",
  },
];

const REVIEWS = [
  {
    name: "Айгерим",
    city: "Алматы",
    band: "7.5",
    text: "Сдала на 7.5 с первого раза, хотя готовилась всего 6 недель. Раньше боялась Speaking больше всего, а здесь каждый день практиковалась с ИИ и на экзамене вообще не волновалась.",
  },
  {
    name: "Тимур",
    city: "Ташкент",
    band: "7.0",
    text: "Honestly, я думал это очередная подписка ради подписки. Через две недели поменял мнение: фидбек по эссе детальнее, чем у моего преподавателя за 30к в месяц.",
  },
  {
    name: "Дарья",
    city: "Москва",
    band: "7.5",
    text: "Нужно было 7.0 для магистратуры в UCL, получила 7.5. Больше всего помог план: я просто открывала приложение и делала, что говорят, без паники и хаоса.",
  },
  {
    name: "Медет",
    city: "Астана",
    band: "8.0",
    text: "Не ожидал, что ИИ так точно оценит Writing. Сравнил его балл со своим прошлым реальным экзаменом - отличие всего 0.5. Это правда работает.",
  },
  {
    name: "Алина",
    city: "Бишкек",
    band: "7.5",
    text: "После третьей попытки наконец взяла 6.5. Главное - это безлимитные пробники, я просто перестала бояться формата экзамена.",
  },
  {
    name: "Нурсултан",
    city: "Шымкент",
    band: "7.0",
    text: "Понравилось, как быстро приходит фидбек по Speaking. Буквально за минуту разбор по всем критериям, никакой репетитор так не успеет.",
  },
];

function CertificatesSection() {
  return (
    <section className="flex flex-col items-center gap-7">
      <div className="text-center">
        <Badge variant="success" className="mb-3">Реальные результаты</Badge>
        <h2 className="text-3xl font-black tracking-normal text-[rgb(var(--foreground))]">IELTS сертификаты студентов</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[rgb(var(--muted-foreground))]">
          Показываем реальные примеры результата, к которому ведёт системная подготовка и регулярный AI-фидбек.
        </p>
      </div>

      <div className="grid w-full max-w-4xl gap-5 md:grid-cols-2">
        {CERTIFICATES.map((certificate) => (
          <div key={certificate.src} className="group relative overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl">
            <div className="absolute left-6 top-6 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[rgb(var(--foreground))] shadow-sm backdrop-blur">
              {certificate.label}
            </div>
            <div className="relative aspect-[0.72] overflow-hidden rounded-xl bg-[rgb(var(--surface-elevated))]">
              <Image
                src={certificate.src}
                alt={certificate.alt}
                fill
                sizes="(min-width: 768px) 420px, 90vw"
                className="object-contain object-top transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function UniversityMarquee() {
  const loop = [...UNIVERSITY_LOGOS, ...UNIVERSITY_LOGOS];

  return (
    <section className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-white py-8 shadow-sm">
      <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.26em] text-[rgb(var(--muted-foreground))]">
        У нас учились те, кто поступили в
      </p>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white to-transparent" />
        <div className="ezielts-marquee flex w-max items-center gap-8">
          {loop.map((university, index) => (
            <div
              key={`${university.name}-${index}`}
              className="flex h-20 min-w-64 items-center gap-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-elevated))] px-5 opacity-90 shadow-sm"
              aria-label={university.name}
            >
              <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-base font-black tracking-normal", university.markClassName)}>
                {university.monogram}
              </div>
              <div className="min-w-0">
                <div className={cn("whitespace-nowrap text-2xl font-black leading-none tracking-normal", university.wordmarkClassName)}>
                  {university.wordmark}
                </div>
                <div className="mt-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground))]">
                  {university.submark}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewsSection() {
  return (
    <section className="flex flex-col items-center gap-8">
      <div className="text-center">
        <div className="text-7xl font-black tracking-normal text-[rgb(var(--foreground))]">4.8</div>
        <div className="mt-2 text-xs font-bold uppercase tracking-[0.3em] text-[rgb(var(--muted-foreground))]">15 700 отзывов</div>
        <h2 className="mt-7 text-3xl font-black tracking-normal text-[rgb(var(--foreground))]">Наши благодарные ученики</h2>
      </div>

      <div className="grid w-full gap-5 md:grid-cols-2 lg:grid-cols-3">
        {REVIEWS.map((review, index) => (
          <article key={`${review.name}-${index}`} className="flex min-h-72 flex-col rounded-2xl border border-[rgb(var(--border))] bg-white p-6 shadow-sm">
            <div className="flex gap-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, starIndex) => (
                <Star key={starIndex} className="h-5 w-5 fill-current" />
              ))}
            </div>

            <p className="mt-5 flex-1 text-sm leading-6 text-[rgb(var(--foreground))]">{review.text}</p>

            <div className="mt-7 flex items-center gap-3 border-t border-[rgb(var(--border))] pt-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--primary)/0.1)] text-sm font-black text-[rgb(var(--primary))]">
                {review.name.slice(0, 1)}
              </div>
              <div>
                <div className="text-sm font-bold text-[rgb(var(--foreground))]">{review.name}</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">{review.city}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[rgb(var(--muted-foreground))]">IELTS</div>
                <div className="font-mono text-lg font-black text-emerald-600">{review.band}</div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ProofSections() {
  return (
    <>
      <CertificatesSection />
      <UniversityMarquee />
      <ReviewsSection />

      <style jsx global>{`
        @keyframes ezielts-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        .ezielts-marquee {
          animation: ezielts-marquee 32s linear infinite;
        }

        .ezielts-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </>
  );
}
