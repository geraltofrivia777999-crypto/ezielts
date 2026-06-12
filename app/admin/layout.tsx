import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ShieldCheck, Users, BookOpen, LayoutDashboard, LogOut } from "lucide-react";

export const metadata = {
  title: "Admin — ieltszen",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] flex">
      {/* Sidebar */}
      <aside className="w-60 bg-[rgb(var(--surface))] border-r border-[rgb(var(--border))] flex flex-col">
        <div className="p-4 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[rgb(var(--primary))]" />
            <span className="font-bold text-[rgb(var(--foreground))]">Admin</span>
          </div>
          <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1 truncate">
            {profile.email}
          </p>
        </div>

        <nav className="flex-1 p-2 flex flex-col gap-1">
          <NavLink href="/admin" icon={LayoutDashboard} label="Дашборд" />
          <NavLink href="/admin/users" icon={Users} label="Пользователи" />
          <NavLink href="/admin/content" icon={BookOpen} label="Контент" />
        </nav>

        <div className="p-2 border-t border-[rgb(var(--border))]">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted)/0.1)] hover:text-[rgb(var(--foreground))]"
          >
            <LogOut className="w-4 h-4" />
            Выйти из админки
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

function NavLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted)/0.1)]"
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
}
