"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  BarChart3,
  ClipboardList,
  Star,
  GraduationCap,
  DollarSign,
  MessageCircle,
  Gift,
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

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-white border-r border-[rgb(var(--border))] flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-[rgb(var(--border))]">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-[rgb(var(--primary))] flex items-center justify-center shadow-sm">
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
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-[rgb(var(--primary))] text-white shadow-sm shadow-[rgb(var(--primary)/0.25)]"
                  : "text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted)/0.08)]"
              )}
            >
              <item.icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-[rgb(var(--muted-foreground))]")} strokeWidth={2.25} />
              {item.label}
            </Link>
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
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-[rgb(var(--primary))] text-white"
                  : "text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted)/0.08)]"
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
        <div className="rounded-xl bg-violet-50 border border-violet-100 p-3 flex items-center gap-3">
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
          className="rounded-xl bg-[rgb(var(--primary))] text-white px-3 py-2.5 flex items-center justify-center gap-2 hover:bg-[rgb(var(--primary)/0.92)] text-xs font-semibold transition-colors"
        >
          <Users className="w-3.5 h-3.5" />
          IELTS Telegram
        </a>
      </div>
    </aside>
  );
}
