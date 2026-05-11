import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminUsersPage() {
  const sb = await createClient();

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: users } = await (sb as any)
    .from("profiles")
    .select(`
      id, name, email, target_band, exam_type, exam_date, created_at,
      band_reading, band_listening, band_writing, band_speaking,
      subscriptions ( plan, status )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  type UserRow = {
    id: string;
    name: string | null;
    email: string;
    target_band: number | null;
    exam_type: string;
    exam_date: string | null;
    created_at: string;
    band_reading: number | null;
    band_listening: number | null;
    band_writing: number | null;
    band_speaking: number | null;
    subscriptions: Array<{ plan: string; status: string }>;
  };

  const rows = (users as UserRow[]) ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-1">Пользователи</h1>
      <p className="text-sm text-[rgb(var(--muted-foreground))] mb-6">
        Всего: <strong>{rows.length}</strong> (показаны последние 200)
      </p>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--muted)/0.05)] border-b border-[rgb(var(--border))]">
              <tr>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Имя</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Email</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">План</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Цель</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">R / L / W / S</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Дата экзамена</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Создан</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const sub = u.subscriptions?.[0];
                const plan = sub?.plan ?? "free";
                return (
                  <tr key={u.id} className="border-b border-[rgb(var(--border))] last:border-0 hover:bg-[rgb(var(--muted)/0.03)]">
                    <td className="p-3 text-[rgb(var(--foreground))] font-medium">{u.name ?? "—"}</td>
                    <td className="p-3 text-[rgb(var(--muted-foreground))]">{u.email}</td>
                    <td className="p-3">
                      <Badge variant={plan === "free" ? "secondary" : "default"}>
                        {plan}
                      </Badge>
                    </td>
                    <td className="p-3 text-[rgb(var(--muted-foreground))]">{u.target_band ?? "—"}</td>
                    <td className="p-3 text-xs font-mono text-[rgb(var(--foreground))]">
                      {(u.band_reading ?? "·")} / {(u.band_listening ?? "·")} / {(u.band_writing ?? "·")} / {(u.band_speaking ?? "·")}
                    </td>
                    <td className="p-3 text-[rgb(var(--muted-foreground))]">
                      {u.exam_date ? new Date(u.exam_date).toLocaleDateString("ru-RU") : "—"}
                    </td>
                    <td className="p-3 text-[rgb(var(--muted-foreground))]">
                      {new Date(u.created_at).toLocaleDateString("ru-RU")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
