"use client";

import * as React from "react";
import { api } from "@/lib/api";

type Metrics = {
  totals: { registered_users: number; dau: number; wau: number; mau: number };
  daily: Array<Record<string, string | number>>;
  users: Array<Record<string, string | number | null>>;
  top_listings: Array<{ id: number; title: string; views: number }>;
};

export default function AnalyticsPage() {
  const [token, setToken] = React.useState("");
  const [metrics, setMetrics] = React.useState<Metrics | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function load() {
    setBusy(true);
    setError("");
    try {
      const result = await api<Metrics>("/admin/metrics?days=30&limit=100", {
        analyticsAdminToken: token,
      });
      setMetrics(result);
      sessionStorage.setItem("carcar.analytics.token", token);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Не удалось загрузить аналитику");
      setMetrics(null);
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    setToken(sessionStorage.getItem("carcar.analytics.token") ?? "");
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Активность пользователей</h1>
        <p className="mt-1 text-sm text-muted-foreground">Сводка за последние 30 дней</p>
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void load(); }}>
        <input
          type="password"
          autoComplete="current-password"
          aria-label="Токен администратора аналитики"
          placeholder="Токен администратора аналитики"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          className="min-w-64 flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
        />
        <button disabled={!token || busy} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {busy ? "Загрузка…" : "Открыть метрики"}
        </button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {metrics && <>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["Регистрации", metrics.totals.registered_users], ["DAU", metrics.totals.dau], ["WAU", metrics.totals.wau], ["MAU", metrics.totals.mau]].map(([label, value]) =>
            <div key={label} className="rounded-xl border p-4"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>
          )}
        </section>
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-x-auto rounded-xl border p-4">
            <h2 className="mb-3 font-semibold">Активность по дням</h2>
            <table className="w-full text-left text-sm"><thead><tr><th>День</th><th>Активные</th><th>Сессии</th><th>Поиски</th><th>Просмотры</th></tr></thead><tbody>
              {metrics.daily.map((day) => <tr key={String(day.day)} className="border-t"><td className="py-2">{String(day.day)}</td><td>{day.active_users}</td><td>{day.sessions}</td><td>{day.searches}</td><td>{day.listing_views}</td></tr>)}
            </tbody></table>
          </div>
          <div className="overflow-x-auto rounded-xl border p-4">
            <h2 className="mb-3 font-semibold">Чаще всего смотрят</h2>
            <ol className="space-y-2 text-sm">{metrics.top_listings.map((item) => <li key={item.id} className="flex justify-between gap-4"><span className="truncate">{item.title}</span><b>{item.views}</b></li>)}</ol>
          </div>
        </section>
        <section className="overflow-x-auto rounded-xl border p-4">
          <h2 className="mb-3 font-semibold">Пользователи · последние 30 дней</h2>
          <table className="w-full min-w-[780px] text-left text-sm"><thead><tr><th>Пользователь</th><th>Последний визит</th><th>Сессии</th><th>Поиски</th><th>Просмотры</th><th>Избранное</th><th>Подписки</th></tr></thead><tbody>
            {metrics.users.map((user) => <tr key={String(user.id)} className="border-t"><td className="py-2">{user.username ? `@${user.username}` : `ID ${user.id}`}</td><td>{String(user.last_seen_at ?? "")}</td><td>{user.sessions}</td><td>{user.searches}</td><td>{user.listing_views}</td><td>{user.favorites_added}</td><td>{user.subscriptions_created}</td></tr>)}
          </tbody></table>
          <p className="mt-3 text-xs text-muted-foreground">Поисковые фразы и параметры фильтров не сохраняются.</p>
        </section>
      </>}
    </main>
  );
}
