"use client";

import { TrendDown, TrendUp } from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { engineVolume, num, powerLabel, price } from "@/lib/format";
import { labelFor, useI18n, type Key } from "@/lib/i18n";
import type { ListingCard, PriceAnalysis, PriceCriterion } from "@/lib/types";

const criterionKey = (key: string): Key => {
  const map: Record<string, Key> = {
    year: "spec.year",
    mileage: "spec.mileage",
    engine: "spec.engine",
    power: "spec.power",
    equipment: "listing.equipment",
    body: "spec.body",
    gearbox: "spec.gearbox",
    drive: "spec.drive",
    fuel: "spec.fuel",
    generation: "spec.generation",
    color: "spec.color",
  };
  return map[key] ?? "spec.year";
};

const perUnitKey = (key: string): Key | null => {
  const map: Record<string, Key> = {
    year: "market.perYear",
    mileage: "market.per10k",
    engine: "market.perLiter",
    power: "market.per100hp",
    equipment: "market.perOption",
  };
  return map[key] ?? null;
};

function signed(value: number | null) {
  if (value == null) return "—";
  const formatted = `${Math.abs(value).toFixed(1).replace(".", ",")}%`;
  return value > 0 ? `+${formatted}` : value < 0 ? `−${formatted}` : formatted;
}

export function PriceReportSheet({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: ListingCard;
}) {
  const { t, lang } = useI18n();
  const analysis: PriceAnalysis | null = item.price_analysis;
  const report = analysis?.report;
  if (!analysis || !report) return null;

  const locale = lang === "uk" ? "uk-UA" : lang === "pl" ? "pl-PL" : lang === "en" ? "en-GB" : "ru-RU";
  const numberFor = (value: number, digits = 1) =>
    value.toLocaleString(locale, { maximumFractionDigits: digits, useGrouping: false });

  const valueFor = (criterion: PriceCriterion, value: string | number | null) => {
    if (value == null || value === "") return "—";
    switch (criterion.key) {
      case "year":
        return typeof value === "number" ? numberFor(value, 1) : String(value);
      case "mileage":
        return `${num(Number(value))} ${t("filter.radius")}`;
      case "engine":
        return engineVolume(Number(value), t("unit.volume"));
      case "power":
        return powerLabel(Number(value), t("unit.power"));
      case "equipment":
        return `${value}`;
      case "body":
        return labelFor(t, "body", String(value));
      case "fuel":
        return labelFor(t, "fuel", String(value));
      case "gearbox":
        return labelFor(t, "gearbox", String(value));
      case "drive":
        return labelFor(t, "drive", String(value));
      default:
        return String(value);
    }
  };

  const tone =
    analysis.verdict === "below"
      ? "text-emerald-600 dark:text-emerald-400"
      : analysis.verdict === "above"
        ? "text-red-600 dark:text-red-400"
        : "text-amber-600 dark:text-amber-400";
  const label =
    analysis.verdict === "below"
      ? t("market.below")
      : analysis.verdict === "above"
        ? t("market.above")
        : t("market.fair");
  const confidence =
    report.confidence === "high"
      ? t("market.confidenceHigh")
      : report.confidence === "medium"
        ? t("market.confidenceMedium")
        : t("market.confidenceLow");

  const low = report.range.low;
  const high = report.range.high;
  const span = Math.max(1, high - low);
  const clamp = (value: number) => Math.min(100, Math.max(0, value));
  const estimatePosition = clamp(((report.estimated - low) / span) * 100);
  const subjectPosition = clamp(((Number(item.price ?? 0) - low) / span) * 100);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("market.reportTitle")}
      fullHeight
      footer={
        <Button className="w-full" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      <div className="space-y-5 pb-6">
        <section className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-2xl font-semibold">{price(report.estimated, item.currency)}</p>
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
          <p className="text-xs text-muted-foreground">
            {t("market.subjectPrice")}: {price(item.price, item.currency)} ·{" "}
            {t("market.rangeLabel")}: {price(low, item.currency)} — {price(high, item.currency)}
          </p>
        </section>

        <section className="space-y-1.5">
          <div className="relative h-3 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500">
            <span
              className="absolute top-1/2 h-2 w-0.5 -translate-y-1/2 bg-white/90"
              style={{ left: `${estimatePosition}%` }}
              aria-hidden
            />
            <span
              className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-foreground shadow"
              style={{ left: `${subjectPosition}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{price(low, item.currency)}</span>
            <span>
              {t("market.marketEstimate")} {price(report.estimated, item.currency)}
            </span>
            <span>{price(high, item.currency)}</span>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-x-4 gap-y-3 border-y py-3 text-sm">
          <div>
            <p className="text-[11px] text-muted-foreground">{t("market.sample")}</p>
            <p className="font-semibold">{report.sample}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">{t("market.excluded")}</p>
            <p className="font-semibold">{report.excluded}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">{t("market.avgSimilarity")}</p>
            <p className="font-semibold">{report.avg_similarity}%</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">{t("market.confidence")}</p>
            <p className="font-semibold">{confidence}</p>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold">{t("market.calcTitle")}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("market.methodText")}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {t("market.baseMedian")}: {price(report.base_median, item.currency)}
            </span>
            <span>
              {t("market.adjustment")}: {signed(report.adjustment_pct)}
            </span>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold">{t("market.criteriaTitle")}</h3>
          <div className="divide-y">
            {report.criteria.map((criterion) => (
              <div key={criterion.key} className="py-3 first:pt-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{t(criterionKey(criterion.key))}</span>
                  <span className="text-right text-xs">
                    <span className="font-medium">{valueFor(criterion, criterion.subject)}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      → {valueFor(criterion, criterion.market)}
                    </span>
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>
                    {t("market.weight")} {Math.round(criterion.weight * 100)}%
                  </span>
                  <span>
                    {t("market.match")} {criterion.match == null ? "—" : `${Math.round(criterion.match * 100)}%`}
                  </span>
                  {criterion.effect_pct != null ? (
                    <span>
                      {t("market.effect")} {signed(criterion.effect_pct)}
                    </span>
                  ) : null}
                  {criterion.per_unit_pct != null && perUnitKey(criterion.key) ? (
                    <span>
                      {t(perUnitKey(criterion.key)!)} {signed(criterion.per_unit_pct)}
                    </span>
                  ) : null}
                </div>
                {criterion.key === "equipment" && criterion.market == null ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("market.equipmentSparse")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t("market.capNote")}
          </p>
        </section>

        {report.comparables.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-base font-semibold">{t("market.comparablesTitle")}</h3>
            <div className="divide-y">
              {report.comparables.map((comp) => (
                <div key={comp.id} className="py-3 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="line-clamp-1 min-w-0 text-sm font-medium">
                      {comp.title || item.title}
                    </p>
                    <p className="shrink-0 font-semibold">{price(comp.price, item.currency)}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {[
                      comp.year,
                      comp.mileage_km ? `${num(comp.mileage_km)} ${t("filter.radius")}` : null,
                      comp.engine_cm3 ? engineVolume(comp.engine_cm3, t("unit.volume")) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate">
                      {[
                        labelFor(t, "body", comp.body),
                        labelFor(t, "gearbox", comp.gearbox),
                        labelFor(t, "drive", comp.drive),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="shrink-0">
                      {t("market.match")} {comp.similarity}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t("market.disclaimer")}
        </p>
      </div>
    </Dialog>
  );
}
