"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  BarChart3,
  ClipboardList,
  Star,
  GraduationCap,
  DollarSign,
  MessageCircle,
  BookOpen,
  Gift,
  Headphones,
  Mic2,
  PenLine,
  Users,
  Sparkles,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", icon: Home,        label: "Главная" },
  { href: "/tests",     icon: ClipboardList, label: "Тесты" },
  { href: "/progress",  icon: BarChart3,   label: "Прогресс" },
  { href: "/plan",      icon: Star,        label: "AI план" },
  { href: "/tutor",     icon: Sparkles,    label: "AI тьютор" },
  { href: "/live",       icon: GraduationCap, label: "Живое Обучение" },
];

const SECONDARY = [
  { href: "/pricing",  icon: DollarSign,    label: "Тарифы" },
  { href: "/settings", icon: MessageCircle, label: "Настройки" },
];

const TEST_SECTIONS = [
  { href: "/tests?skill=reading", key: "reading", icon: BookOpen, label: "Reading" },
  { href: "/tests?skill=listening", key: "listening", icon: Headphones, label: "Listening" },
  { href: "/tests?skill=writing", key: "writing", icon: PenLine, label: "Writing" },
  { href: "/tests?skill=speaking", key: "speaking", icon: Mic2, label: "Speaking" },
] as const;

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawTestSection = searchParams.get("skill");
  const hasCatalogSection = TEST_SECTIONS.some((section) => section.key === rawTestSection);
  const activeTestSection = hasCatalogSection ? rawTestSection : null;

  return (
    <aside className="flex h-full min-h-0 w-60 flex-col border-r border-[rgb(var(--border))] bg-[rgb(var(--surface))/0.96] backdrop-blur-md supports-[backdrop-filter]:bg-white/88">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-[rgb(var(--border))]">
        <Link href="/" className="flex items-center gap-2 group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary))] focus-visible:ring-offset-2">
          <div className="w-9 h-9 rounded-xl bg-[rgb(var(--primary))] flex items-center justify-center shadow-md shadow-[rgb(var(--primary)/0.22)] ring-1 ring-white/30">
            <span className="text-white font-bold text-sm">EZ</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-[rgb(var(--foreground))] text-base tracking-tight">EZielts</span>
            <span className="text-[10px] text-[rgb(var(--muted-foreground))] uppercase tracking-widest">AI Prep</span>
          </div>
        </Link>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = item.href === "/tests"
            ? (pathname === "/tests" && !activeTestSection) || Boolean(pathname?.startsWith("/tests/"))
            : pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Fragment key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary))] focus-visible:ring-offset-2",
                  active
                    ? "bg-[rgb(var(--primary))] text-white shadow-md shadow-[rgb(var(--primary)/0.22)]"
                    : "text-[rgb(var(--foreground))] hover:bg-[rgb(var(--primary)/0.06)]"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 w-1 h-5 bg-white rounded-full" />
                )}
                <item.icon className={cn("w-4 h-4 shrink-0 transition-colors duration-200", active ? "text-white" : "text-[rgb(var(--muted-foreground))]")} strokeWidth={2.25} />
                {item.label}
              </Link>

              {item.href === "/tests" && TEST_SECTIONS.map((section) => {
                const SectionIcon = section.icon;
                const sectionActive = pathname === "/tests" && activeTestSection === section.key;
                return (
                  <Link
                    key={section.key}
                    href={section.href}
                    onClick={onNavigate}
                    className={cn(
                      "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary))] focus-visible:ring-offset-2",
                      sectionActive
                        ? "bg-[rgb(var(--primary))] text-white shadow-md shadow-[rgb(var(--primary)/0.22)]"
                        : "text-[rgb(var(--foreground))] hover:bg-[rgb(var(--primary)/0.06)]"
                    )}
                  >
                    {sectionActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 w-1 h-5 bg-white rounded-full" />
                    )}
                    <SectionIcon className={cn("w-4 h-4 shrink-0 transition-colors duration-200", sectionActive ? "text-white" : "text-[rgb(var(--muted-foreground))]")} strokeWidth={2.25} />
                    {section.label}
                  </Link>
                );
              })}
            </Fragment>
          );
        })}

        <div className="my-2 h-px bg-[rgb(var(--border))] mx-1" />

        {SECONDARY.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary))] focus-visible:ring-offset-2",
                active
                  ? "bg-[rgb(var(--primary))] text-white shadow-md shadow-[rgb(var(--primary)/0.22)]"
                  : "text-[rgb(var(--foreground))] hover:bg-[rgb(var(--primary)/0.06)]"
              )}
            >
              <item.icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-[rgb(var(--muted-foreground))]")} strokeWidth={2.25} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom cards */}
      <div className="px-3 pb-3 flex flex-col gap-2 shrink-0">
        <div className="rounded-xl bg-[rgb(var(--primary)/0.07)] border border-[rgb(var(--primary)/0.14)] p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
            <Gift className="w-4 h-4 text-[rgb(var(--primary))]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-[rgb(var(--foreground))] leading-tight">Пригласи друзей</div>
            <div className="text-[10px] text-[rgb(var(--muted-foreground))] leading-tight mt-0.5">+ неделя Pro</div>
          </div>
        </div>
        <a
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-[rgb(var(--primary))] text-white px-3 py-2.5 flex items-center justify-center gap-2 hover:bg-[rgb(var(--primary)/0.92)] text-xs font-semibold transition-[background-color,box-shadow] duration-150 ease-out shadow-sm shadow-[rgb(var(--primary)/0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary))] focus-visible:ring-offset-2"
        >
          <Users className="w-3.5 h-3.5" />
          IELTS Telegram
        </a>
      </div>
    </aside>
  );
}
