"use client";

import * as React from "react";
import { Tag, TrendDown, TrendUp } from "@phosphor-icons/react";
import { PriceReportSheet } from "@/components/price-report-sheet";
import { Button } from "@/components/ui/button";
import { price } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { ListingCard } from "@/lib/types";

export function PriceMarket({ item }: { item: ListingCard }) {
  const { t } = useI18n();
  const [reportOpen, setReportOpen] = React.useState(false);
  const analysis = item.price_analysis;
  if (!analysis || item.price == null) return null;

  const clamp = (value: number) => Math.min(100, Math.max(0, value));
  const low = analysis.p10 ?? Math.round(analysis.median * 0.7);
  const high = analysis.p90 ?? Math.round(analysis.median * 1.3);
  const span = Math.max(1, high - low);
  const position = clamp(((item.price - low) / span) * 100);
  const medianPosition = clamp(((analysis.median - low) / span) * 100);

  const tone =
    analysis.verdict === "below"
      ? "text-emerald-600"
      : analysis.verdict === "above"
        ? "text-red-600"
        : "text-amber-600";

  const label =
    analysis.verdict === "below"
      ? t("market.below")
      : analysis.verdict === "above"
        ? t("market.above")
        : t("market.fair");

  return (
    <>
    <section className="space-y-3 border-t pt-4">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Tag size={18} /> {t("market.title")}
      </h2>

      <div className="flex items-baseline justify-between gap-2">
        <p className="text-2xl font-semibold">{price(analysis.median, item.currency)}</p>
        <span className={`inline-flex items-center gap-1 text-sm font-medium ${tone}`}>
          {analysis.verdict === "below" ? (
            <TrendDown size={16} />
          ) : analysis.verdict === "above" ? (
            <TrendUp size={16} />
          ) : null}
          {analysis.diff_pct > 0 ? "+" : ""}
          {analysis.diff_pct}% · {label}
        </span>
      </div>

      <div className="space-y-1">
        <div className="relative h-2.5 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500">
          <span
            className="absolute top-1/2 h-2 w-0.5 -translate-y-1/2 bg-white/80"
            style={{ left: `${medianPosition}%` }}
            aria-hidden
          />
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-foreground shadow"
            style={{ left: `${position}%` }}
            title={`${t("market.thisCar")}: ${price(item.price, item.currency)}`}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{price(low, item.currency)}</span>
          <span>
            {t("market.median")} {price(analysis.median, item.currency)}
          </span>
          <span>{price(high, item.currency)}</span>
        </div>
      </div>

      {analysis.report ? (
        <Button variant="outline" className="w-full" onClick={() => setReportOpen(true)}>
          <Tag size={18} />
          {t("market.report")}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("market.thisCar")} — {price(item.price, item.currency)}. {t("market.explain")} ·{" "}
          {analysis.sample}
        </p>
      )}
    </section>
    <PriceReportSheet open={reportOpen} onClose={() => setReportOpen(false)} item={item} />
    </>
  );
}
