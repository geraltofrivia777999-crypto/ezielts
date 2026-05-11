import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Crown, FileText, Headphones, PenLine, Mic2, TrendingUp } from "lucide-react";

export default async function AdminDashboard() {
  const sb = await createClient();

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const sbAny = sb as any;

  // Parallel counts
  const [
    totalUsers,
    proUsers,
    readingTests,
    listeningTests,
    writingTasks,
    speakingTopics,
    totalAttempts,
    recentSignups,
  ] = await Promise.all([
    sbAny.from("profiles").select("*", { count: "exact", head: true }),
    sbAny.from("subscriptions").select("*", { count: "exact", head: true }).neq("plan", "free"),
    sbAny.from("reading_tests").select("*", { count: "exact", head: true }),
    sbAny.from("listening_tests").select("*", { count: "exact", head: true }),
    sbAny.from("writing_tasks").select("*", { count: "exact", head: true }),
    sbAny.from("speaking_topics").select("*", { count: "exact", head: true }),
    sbAny.from("user_test_attempts").select("*", { count: "exact", head: true }),
    sbAny.from("profiles").select("id, name, email, created_at").order("created_at", { ascending: false }).limit(5),
  ]);

  const stats = [
    { label: "Всего пользователей", value: totalUsers.count ?? 0, icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Pro подписки", value: proUsers.count ?? 0, icon: Crown, color: "text-amber-500", bg: "bg-amber-50" },
    { label: "Попыток тестов", value: totalAttempts.count ?? 0, icon: TrendingUp, color: "text-teal-500", bg: "bg-teal-50" },
  ];

  const content = [
    { label: "Reading тестов", value: readingTests.count ?? 0, icon: FileText, color: "text-blue-500" },
    { label: "Listening тестов", value: listeningTests.count ?? 0, icon: Headphones, color: "text-purple-500" },
    { label: "Writing тасков", value: writingTasks.count ?? 0, icon: PenLine, color: "text-teal-500" },
    { label: "Speaking топиков", value: speakingTopics.count ?? 0, icon: Mic2, color: "text-violet-500" },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-1">Дашборд</h1>
      <p className="text-sm text-[rgb(var(--muted-foreground))] mb-8">Общая статистика платформы</p>

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
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--muted)/0.05)] border-b border-[rgb(var(--border))]">
              <tr>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Имя</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Email</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Дата</th>
              </tr>
            </thead>
            <tbody>
              {((recentSignups.data ?? []) as Array<{id: string; name: string | null; email: string; created_at: string}>).map((u) => (
                <tr key={u.id} className="border-b border-[rgb(var(--border))] last:border-0">
                  <td className="p-3 text-[rgb(var(--foreground))]">{u.name ?? "—"}</td>
                  <td className="p-3 text-[rgb(var(--muted-foreground))]">{u.email}</td>
                  <td className="p-3 text-[rgb(var(--muted-foreground))]">
                    {new Date(u.created_at).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
