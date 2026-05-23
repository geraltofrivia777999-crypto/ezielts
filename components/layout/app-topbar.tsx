"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Bell, Menu, LogOut, Settings as SettingsIcon, User as UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AppTopbar({
  title,
  onMenuClick,
}: {
  title: string;
  onMenuClick?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const { data } = await (sb as any).from("profiles").select("name").eq("id", user.id).single();
      setName(data?.name ?? "");
    }
    load();
  }, []);

  async function handleSignOut() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initial = (name || email || "У").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-[rgb(var(--surface))/0.86] supports-[backdrop-filter]:bg-white/75 backdrop-blur-xl border-b border-[rgb(var(--border))]">
      <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 rounded-lg hover:bg-[rgb(var(--primary)/0.06)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary))]"
          aria-label="Меню"
        >
          <Menu className="w-5 h-5 text-[rgb(var(--foreground))]" />
        </button>

        {/* Page title */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] shadow-sm">
          <span className="text-sm font-medium text-[rgb(var(--foreground))]">{title}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            className="p-2 rounded-lg hover:bg-[rgb(var(--primary)/0.06)] relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary))]"
            aria-label="Уведомления"
          >
            <Bell className="w-4 h-4 text-[rgb(var(--muted-foreground))]" />
          </button>

          {/* Avatar dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-9 h-9 rounded-full bg-[rgb(var(--primary))] flex items-center justify-center text-white font-bold text-sm hover:opacity-90 transition-all shadow-md shadow-[rgb(var(--primary)/0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary))] focus-visible:ring-offset-2"
            >
              {initial}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-50 w-56 bg-white border border-[rgb(var(--border))] rounded-2xl shadow-xl shadow-black/10 overflow-hidden animate-slide-down">
                  <div className="px-4 py-3 border-b border-[rgb(var(--border))]">
                    <div className="font-semibold text-[rgb(var(--foreground))] text-sm truncate">{name || "Студент"}</div>
                    <div className="text-xs text-[rgb(var(--muted-foreground))] truncate">{email}</div>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-[rgb(var(--foreground))] hover:bg-[rgb(var(--primary)/0.06)] transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-[rgb(var(--muted-foreground))]" />
                    Профиль
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-[rgb(var(--foreground))] hover:bg-[rgb(var(--primary)/0.06)] transition-colors"
                  >
                    <SettingsIcon className="w-4 h-4 text-[rgb(var(--muted-foreground))]" />
                    Настройки
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className={cn(
                      "w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-[rgb(var(--border))] transition-colors"
                    )}
                  >
                    <LogOut className="w-4 h-4" />
                    Выйти
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
