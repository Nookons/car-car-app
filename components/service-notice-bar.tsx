"use client";

import { useEffect, useState } from "react";
import { Wrench, Pause } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";

type ServiceNotice = {
  source: string;
  mode: "paused" | "maintenance";
  reason: string;
  starts_at: string;
  ends_at: string;
};

function formatWindow(start: string, end: string, locale: string) {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  const from = new Date(start).toLocaleString(locale, options);
  const to = new Date(end).toLocaleString(locale, options);
  return `${from} — ${to}`;
}

export function ServiceNoticeBar() {
  const { lang } = useI18n();
  const [notices, setNotices] = useState<ServiceNotice[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/service-status", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { notices?: ServiceNotice[] };
        if (alive) setNotices(Array.isArray(data.notices) ? data.notices : []);
      } catch {
        // The banner is informational; a temporary status API outage must not
        // block navigation or render a misleading maintenance state.
      }
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, []);

  if (!notices.length) return null;

  const locale = lang === "ru" ? "ru-RU" : lang === "pl" ? "pl-PL" : lang === "uk" ? "uk-UA" : "en-GB";
  return (
    <aside
      aria-label={lang === "ru" ? "Состояние сервисов" : "Service status"}
      className="border-b border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/70 dark:text-amber-100"
      role="status"
    >
      <div className="mx-auto flex min-h-8 max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1 text-[11px] leading-4 sm:text-xs">
        {notices.map((notice) => {
          const repairing = notice.mode === "maintenance";
          const Icon = repairing ? Wrench : Pause;
          const stateLabel =
            lang === "ru"
              ? repairing ? "на обслуживании" : "временно приостановлен"
              : lang === "pl"
                ? repairing ? "w konserwacji" : "tymczasowo wstrzymany"
                : lang === "uk"
                  ? repairing ? "на обслуговуванні" : "тимчасово призупинений"
                  : repairing ? "under maintenance" : "temporarily paused";
          return (
            <span className="inline-flex flex-wrap items-center gap-x-1.5" key={notice.source}>
              <Icon aria-hidden="true" className="shrink-0" size={13} weight="bold" />
              <strong>{notice.source}</strong>
              <span>{stateLabel}</span>
              <span className="text-amber-900/75 dark:text-amber-200/75">· {notice.reason}</span>
              <span className="tabular-nums text-amber-900/75 dark:text-amber-200/75">· {formatWindow(notice.starts_at, notice.ends_at, locale)}</span>
            </span>
          );
        })}
      </div>
    </aside>
  );
}
