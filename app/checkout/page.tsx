import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPricingPlan } from "@/lib/plans";
import { Check, ChevronLeft, CreditCard, Shield } from "lucide-react";

type CheckoutPageProps = {
  searchParams: Promise<{ plan?: string | string[] }>;
};

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  const rawPlan = Array.isArray(params.plan) ? params.plan[0] : params.plan;
  const plan = getPricingPlan(rawPlan);

  if (!plan) redirect("/pricing");

  return (
    <div className="min-h-screen bg-[rgb(var(--background))]">
      <header className="border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <Link href="/pricing" className="flex items-center gap-1 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
            <ChevronLeft className="h-4 w-4" />
            Тарифы
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[1fr_0.8fr]">
        <section className="rounded-2xl border border-[rgb(var(--border))] bg-white p-7 shadow-sm">
          <Badge variant="default" className="mb-5">Оформление подписки</Badge>
          <h1 className="text-3xl font-black text-[rgb(var(--foreground))]">{plan.name}</h1>
          <p className="mt-2 text-[rgb(var(--muted-foreground))]">{plan.eyebrow} · {plan.periodLabel}</p>

          <div className="mt-6 flex items-end gap-2">
            <span className="text-5xl font-black text-[rgb(var(--foreground))]">${plan.price}</span>
            {plan.monthlyLabel && <span className="pb-2 text-sm font-bold text-emerald-700">{plan.monthlyLabel}</span>}
          </div>

          <div className="mt-8 rounded-2xl bg-[rgb(var(--surface-elevated))] p-5">
            <div className="mb-4 flex items-center gap-2 font-semibold text-[rgb(var(--foreground))]">
              <Shield className="h-4 w-4 text-emerald-600" />
              Доступ после оплаты
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {plan.included.map((feature) => (
                <li key={feature} className="flex gap-2 text-sm leading-5 text-[rgb(var(--foreground))]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="rounded-2xl border border-[rgb(var(--border))] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-[rgb(var(--foreground))]">Оплата</h2>
          <p className="mt-2 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
            Тариф уже выбран и передаётся как <span className="font-mono text-[rgb(var(--foreground))]">{plan.id}</span>.
            После подключения платежного провайдера эта кнопка будет вести на оплату и активировать нужный plan в Supabase.
          </p>

          <Button className="mt-6 h-12 w-full rounded-xl" disabled>
            <CreditCard className="h-4 w-4" />
            Оплата FreedomPay скоро
          </Button>

          <Button asChild variant="outline" className="mt-3 h-12 w-full rounded-xl">
            <Link href="/pricing">Выбрать другой тариф</Link>
          </Button>
        </aside>
      </main>
    </div>
  );
}
