import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Headphones, PenLine, Mic2, ExternalLink } from "lucide-react";

type Tab = "reading" | "listening" | "writing" | "speaking";

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: Tab; page?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab ?? "reading";
  const page = Math.max(0, parseInt(params.page ?? "0", 10));
  const limit = 50;

  const sb = await createClient();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const sbAny = sb as any;

  let rows: Array<Record<string, unknown>> = [];
  let total = 0;

  if (tab === "reading") {
    const { data, count } = await sbAny
      .from("reading_tests")
      .select("id, title, source, category, difficulty, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * limit, page * limit + limit - 1);
    rows = data ?? [];
    total = count ?? 0;
  } else if (tab === "listening") {
    const { data, count } = await sbAny
      .from("listening_tests")
      .select("id, title, source, section, audio_url, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * limit, page * limit + limit - 1);
    rows = data ?? [];
    total = count ?? 0;
  } else if (tab === "writing") {
    const { data, count } = await sbAny
      .from("writing_tasks")
      .select("id, prompt_text, task_type, exam_type, image_url, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * limit, page * limit + limit - 1);
    rows = data ?? [];
    total = count ?? 0;
  } else if (tab === "speaking") {
    const { data, count } = await sbAny
      .from("speaking_topics")
      .select("id, topic_text, part, band_range, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * limit, page * limit + limit - 1);
    rows = data ?? [];
    total = count ?? 0;
  }

  const tabs: Array<{ key: Tab; label: string; icon: React.ElementType; color: string }> = [
    { key: "reading", label: "Reading", icon: FileText, color: "text-blue-500" },
    { key: "listening", label: "Listening", icon: Headphones, color: "text-purple-500" },
    { key: "writing", label: "Writing", icon: PenLine, color: "text-teal-500" },
    { key: "speaking", label: "Speaking", icon: Mic2, color: "text-violet-500" },
  ];

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-[rgb(var(--foreground))] mb-1">Контент</h1>
      <p className="text-sm text-[rgb(var(--muted-foreground))] mb-6">
        Всего: <strong>{total}</strong> · Стр. {page + 1} / {Math.max(1, totalPages)}
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[rgb(var(--border))]">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/content?tab=${t.key}`}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key
                ? "border-[rgb(var(--primary))] text-[rgb(var(--foreground))]"
                : "border-transparent text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
            }`}
          >
            <t.icon className={`w-4 h-4 ${t.color}`} />
            {t.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--muted)/0.05)] border-b border-[rgb(var(--border))]">
              {tab === "reading" && (
                <tr>
                  <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Название</th>
                  <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Источник</th>
                  <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Категория</th>
                  <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Сложность</th>
                </tr>
              )}
              {tab === "listening" && (
                <tr>
                  <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Название</th>
                  <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Секция</th>
                  <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Аудио</th>
                </tr>
              )}
              {tab === "writing" && (
                <tr>
                  <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Текст задания</th>
                  <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Тип</th>
                  <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Экзамен</th>
                  <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Картинка</th>
                </tr>
              )}
              {tab === "speaking" && (
                <tr>
                  <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Топик</th>
                  <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Part</th>
                  <th className="text-left p-3 font-medium text-[rgb(var(--muted-foreground))]">Band</th>
                </tr>
              )}
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id as string} className="border-b border-[rgb(var(--border))] last:border-0 hover:bg-[rgb(var(--muted)/0.03)]">
                  {tab === "reading" && (
                    <>
                      <td className="p-3 text-[rgb(var(--foreground))] max-w-md truncate">{r.title as string}</td>
                      <td className="p-3 text-[rgb(var(--muted-foreground))]">{r.source as string}</td>
                      <td className="p-3 text-[rgb(var(--muted-foreground))]">{r.category as string}</td>
                      <td className="p-3 text-[rgb(var(--muted-foreground))]">{(r.difficulty as string) ?? "—"}</td>
                    </>
                  )}
                  {tab === "listening" && (
                    <>
                      <td className="p-3 text-[rgb(var(--foreground))] max-w-md truncate">{r.title as string}</td>
                      <td className="p-3 text-[rgb(var(--muted-foreground))]">{(r.section as number) ?? "—"}</td>
                      <td className="p-3">
                        {r.audio_url ? (
                          <a href={r.audio_url as string} target="_blank" rel="noopener noreferrer" className="text-[rgb(var(--primary))] hover:underline inline-flex items-center gap-1">
                            <ExternalLink className="w-3.5 h-3.5" /> open
                          </a>
                        ) : (
                          <span className="text-[rgb(var(--muted))]">—</span>
                        )}
                      </td>
                    </>
                  )}
                  {tab === "writing" && (
                    <>
                      <td className="p-3 text-[rgb(var(--foreground))] max-w-md truncate">{r.prompt_text as string}</td>
                      <td className="p-3 text-[rgb(var(--muted-foreground))]">{r.task_type as string}</td>
                      <td className="p-3 text-[rgb(var(--muted-foreground))]">{(r.exam_type as string) ?? "—"}</td>
                      <td className="p-3">
                        {r.image_url ? (
                          <a href={r.image_url as string} target="_blank" rel="noopener noreferrer" className="text-[rgb(var(--primary))] hover:underline inline-flex items-center gap-1">
                            <ExternalLink className="w-3.5 h-3.5" /> open
                          </a>
                        ) : (
                          <span className="text-[rgb(var(--muted))]">—</span>
                        )}
                      </td>
                    </>
                  )}
                  {tab === "speaking" && (
                    <>
                      <td className="p-3 text-[rgb(var(--foreground))] max-w-md truncate">{r.topic_text as string}</td>
                      <td className="p-3 text-[rgb(var(--muted-foreground))]">Part {r.part as number}</td>
                      <td className="p-3 text-[rgb(var(--muted-foreground))]">{(r.band_range as string) ?? "—"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <Link
            href={`/admin/content?tab=${tab}&page=${Math.max(0, page - 1)}`}
            className={`text-sm px-3 py-1.5 rounded border border-[rgb(var(--border))] ${
              page === 0 ? "opacity-40 pointer-events-none" : "hover:bg-[rgb(var(--muted)/0.1)]"
            }`}
          >
            ← Назад
          </Link>
          <span className="text-xs text-[rgb(var(--muted-foreground))]">
            {page * limit + 1}–{Math.min((page + 1) * limit, total)} из {total}
          </span>
          <Link
            href={`/admin/content?tab=${tab}&page=${page + 1}`}
            className={`text-sm px-3 py-1.5 rounded border border-[rgb(var(--border))] ${
              page + 1 >= totalPages ? "opacity-40 pointer-events-none" : "hover:bg-[rgb(var(--muted)/0.1)]"
            }`}
          >
            Вперёд →
          </Link>
        </div>
      )}
    </div>
  );
}
