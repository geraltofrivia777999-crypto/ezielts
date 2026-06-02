import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/admin";
import { getAdminUsersData, type AdminUserRow } from "@/lib/admin-data";
import type { ContentType } from "@/lib/supabase/types";
import { AlertTriangle, Clock, Crown, UserCheck, Users } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

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

function bandValue(value: number | null) {
  return value === null ? "·" : value.toFixed(1);
}

function BandsLine({ bands }: { bands: Record<ContentType, number | null> }) {
  return (
    <span className="font-mono text-xs text-[rgb(var(--foreground))] whitespace-nowrap">
      {bandValue(bands.reading)} / {bandValue(bands.listening)} / {bandValue(bands.writing)} / {bandValue(bands.speaking)}
    </span>
  );
}

function PlanBadge({ user }: { user: AdminUserRow }) {
  const plan = user.subscription?.plan ?? "free";
  const status = user.subscription?.status ?? "active";
  const paid = plan !== "free" && status === "active";

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={paid ? "default" : "secondary"}>{plan}</Badge>
      {status !== "active" && (
        <span className="text-[11px] text-[rgb(var(--muted-foreground))]">{status}</span>
      )}
    </div>
  );
}

export default async function AdminUsersPage() {
  await requireAdmin();
  const data = await getAdminUsersData();
  const rows = data.users;

  const cards = [
    { label: "Auth users", value: data.totalAuthUsers, icon: Users, className: "text-blue-500 bg-blue-50" },
    { label: "Profiles", value: data.totalProfiles, icon: UserCheck, className: "text-emerald-500 bg-emerald-50" },
    { label: "Paid active", value: data.totalPaidUsers, icon: Crown, className: "text-amber-500 bg-amber-50" },
    { label: "Attempts", value: data.totalAttempts, icon: Clock, className: "text-violet-500 bg-violet-50" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-1">Пользователи</h1>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">
            Показываем всех пользователей из Supabase Auth. Обновлено: {formatDateTime(data.generatedAt)}
          </p>
        </div>
        <Badge variant="outline">{rows.length} строк</Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.className}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[rgb(var(--foreground))]">{card.value}</div>
                <div className="text-xs text-[rgb(var(--muted-foreground))]">{card.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.missingProfiles > 0 && (
        <Card className="mb-6 border-[rgb(var(--warning)/0.35)] bg-[rgb(var(--warning)/0.06)]">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--warning))]" />
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              {data.missingProfiles} пользователей есть в Auth, но не имеют строки в profiles. Такие строки помечены в таблице,
              поэтому их теперь видно, но часть учебных данных может быть пустой.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--muted)/0.05)] border-b border-[rgb(var(--border))]">
              <tr>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Имя</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Email</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">WhatsApp</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">План</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Цель / текущий</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Профиль R/L/W/S</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Последние R/L/W/S</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Попытки</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Диагностика</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Дата экзамена</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Последний вход</th>
                <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Создан</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                return (
                  <tr key={u.id} className="border-b border-[rgb(var(--border))] last:border-0 hover:bg-[rgb(var(--muted)/0.03)]">
                    <td className="p-3 text-[rgb(var(--foreground))] font-medium min-w-44">
                      <div className="flex items-center gap-2">
                        <span>{u.name ?? "—"}</span>
                        {u.isAdmin && <Badge variant="warning">admin</Badge>}
                      </div>
                      {!u.hasProfile && (
                        <div className="mt-1 text-[11px] text-[rgb(var(--warning))]">нет profiles</div>
                      )}
                    </td>
                    <td className="p-3 text-[rgb(var(--muted-foreground))] min-w-56">
                      {u.email ?? "—"}
                      <div className="mt-1 font-mono text-[10px] text-[rgb(var(--muted-foreground))]">{u.id.slice(0, 8)}</div>
                    </td>
                    <td className="p-3">
                      {u.phone ? (
                        <a
                          href={`https://wa.me/${u.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[#25D366] hover:underline font-mono text-xs"
                        >
                          {u.phone}
                        </a>
                      ) : (
                        <span className="text-[rgb(var(--muted))]">—</span>
                      )}
                    </td>
                    <td className="p-3"><PlanBadge user={u} /></td>
                    <td className="p-3 text-[rgb(var(--muted-foreground))] whitespace-nowrap">
                      {u.targetBand ?? "—"} / {u.currentBand ?? "—"}
                      <div className="mt-1 text-[11px]">{u.examType ?? "unknown"} · {u.goal ?? "—"}</div>
                    </td>
                    <td className="p-3"><BandsLine bands={u.bands} /></td>
                    <td className="p-3"><BandsLine bands={u.lastBands} /></td>
                    <td className="p-3 text-[rgb(var(--muted-foreground))] whitespace-nowrap">
                      <span className="font-semibold text-[rgb(var(--foreground))]">{u.attemptsCount}</span>
                      <div className="mt-1 text-[11px]">last: {formatDate(u.lastActivityAt)}</div>
                    </td>
                    <td className="p-3 text-[rgb(var(--muted-foreground))] whitespace-nowrap">
                      {u.diagnostic?.overall_band ?? "—"}
                      {u.diagnostic && (
                        <div className="mt-1 text-[11px]">
                          R {u.diagnostic.band_reading ?? "·"} / G {u.diagnostic.band_grammar ?? "·"}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-[rgb(var(--muted-foreground))]">
                      {formatDate(u.examDate)}
                    </td>
                    <td className="p-3 text-[rgb(var(--muted-foreground))] whitespace-nowrap">
                      {formatDateTime(u.lastSignInAt)}
                    </td>
                    <td className="p-3 text-[rgb(var(--muted-foreground))] whitespace-nowrap">
                      {formatDateTime(u.createdAt)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-10 text-center text-[rgb(var(--muted-foreground))]">
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
