import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/admin";
import { getAdminContentCounts, getAdminUsersData } from "@/lib/admin-data";
import { Users, Crown, FileText, Headphones, PenLine, Mic2, TrendingUp, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function AdminDashboard() {
  await requireAdmin();

  const [usersData, contentCounts] = await Promise.all([
    getAdminUsersData(),
    getAdminContentCounts(),
  ]);

  const stats = [
    { label: "Auth пользователей", value: usersData.totalAuthUsers, icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Активные платные", value: usersData.totalPaidUsers, icon: Crown, color: "text-amber-500", bg: "bg-amber-50" },
    { label: "Попыток тестов", value: usersData.totalAttempts, icon: TrendingUp, color: "text-teal-500", bg: "bg-teal-50" },
  ];

  const content = [
    { label: "Reading тестов", value: contentCounts.readingTests, icon: FileText, color: "text-blue-500" },
    { label: "Listening тестов", value: contentCounts.listeningTests, icon: Headphones, color: "text-purple-500" },
    { label: "Writing тасков", value: contentCounts.writingTasks, icon: PenLine, color: "text-teal-500" },
    { label: "Speaking топиков", value: contentCounts.speakingTopics, icon: Mic2, color: "text-violet-500" },
  ];
  const recentSignups = usersData.users.slice(0, 8);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-1">Дашборд</h1>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            Живые данные из Supabase. Обновлено: {formatDateTime(usersData.generatedAt)}
          </p>
        </div>
        <Badge variant="outline">{usersData.totalProfiles} профилей</Badge>
      </div>

      {/* User stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-6 h-6 ${s.color}`} />
              </div>
              <div>
                <div className="text-3xl font-bold text-[rgb(var(--foreground))]">{s.value}</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {usersData.missingProfiles > 0 && (
        <Card className="mb-8 border-[rgb(var(--warning)/0.35)] bg-[rgb(var(--warning)/0.06)]">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--warning))]" />
            <div>
              <div className="font-semibold text-[rgb(var(--foreground))]">Есть пользователи без строки в profiles</div>
              <p className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">
                Найдено {usersData.missingProfiles}. Они теперь отображаются в админке через auth.users, но для полноценной
                статистики им нужно восстановить профиль и free-подписку.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content stats */}
      <h2 className="text-lg font-bold text-[rgb(var(--foreground))] mb-3">Контент в базе</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {content.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <c.icon className={`w-4 h-4 ${c.color}`} />
                <span className="text-xs text-[rgb(var(--muted-foreground))]">{c.label}</span>
              </div>
              <div className="text-2xl font-bold text-[rgb(var(--foreground))]">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent signups */}
      <h2 className="text-lg font-bold text-[rgb(var(--foreground))] mb-3">Последние регистрации</h2>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--muted)/0.05)] border-b border-[rgb(var(--border))]">
              <tr>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Имя</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Email</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">План</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Активность</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Регистрация</th>
              </tr>
            </thead>
            <tbody>
              {recentSignups.map((u) => (
                <tr key={u.id} className="border-b border-[rgb(var(--border))] last:border-0">
                  <td className="p-3 text-[rgb(var(--foreground))]">{u.name ?? "—"}</td>
                  <td className="p-3 text-[rgb(var(--muted-foreground))]">{u.email}</td>
                  <td className="p-3">
                    <Badge variant={u.subscription?.plan === "free" || !u.subscription ? "secondary" : "default"}>
                      {u.subscription?.plan ?? "free"}
                    </Badge>
                  </td>
                  <td className="p-3 text-[rgb(var(--muted-foreground))]">
                    {u.attemptsCount} попыток
                  </td>
                  <td className="p-3 text-[rgb(var(--muted-foreground))] whitespace-nowrap">
                    {formatDateTime(u.createdAt)}
                  </td>
                </tr>
              ))}
              {recentSignups.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[rgb(var(--muted-foreground))]">
                    Пользователей пока нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
