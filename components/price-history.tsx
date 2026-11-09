"use client";

import * as React from "react";
import { TrendDown, TrendUp } from "@phosphor-icons/react";
import { date, price } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { ListingCard } from "@/lib/types";

/**
 * История цены: стартовая цена, изменения из listing_event и текущая.
 * Показываем только когда изменение реально было — одна точка бесполезна.
 */
export function PriceHistory({ item }: { item: ListingCard }) {
  const { t, lang } = useI18n();
  const points = item.price_history ?? [];
  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const delta = last.price - first.price;
  const percent = first.price ? Math.round((delta / first.price) * 100) : 0;
  const tone =
    delta < 0
      ? "text-emerald-600 dark:text-emerald-400"
      : delta > 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <section className="space-y-3 border-t pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{t("history.title")}</h2>
        <span className={`inline-flex items-center gap-1 text-sm font-medium ${tone}`}>
          {delta < 0 ? <TrendDown size={16} /> : delta > 0 ? <TrendUp size={16} /> : null}
          {delta === 0
            ? "0%"
            : `${delta < 0 ? "−" : "+"}${price(Math.abs(delta), item.currency)} · ${Math.abs(
                percent,
              )}%`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("history.since").replace("{date}", first.at ? date(first.at, lang) : "—")}
      </p>

      <ol className="divide-y rounded-xl border bg-card">
        {points.map((point, index) => {
          const previous = index ? points[index - 1].price : null;
          const change = previous == null ? 0 : point.price - previous;
          const caption =
            index === 0 ? t("history.first") : index === points.length - 1 ? t("history.now") : "";
          return (
            <li key={`${point.at ?? "none"}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <span className="shrink-0">{point.at ? date(point.at, lang) : "—"}</span>
                {caption ? <span className="truncate text-[11px]">· {caption}</span> : null}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {change !== 0 ? (
                  <span
                    className={
                      change < 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }
                  >
                    {change < 0 ? "↓" : "↑"}
                  </span>
                ) : null}
                <span className={index === points.length - 1 ? "font-semibold" : "font-medium"}>
                  {price(point.price, item.currency)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
