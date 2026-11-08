"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { price } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Filters } from "@/lib/types";

const YEAR_NOW = new Date().getFullYear();
const YEARS = Array.from({ length: YEAR_NOW - 1989 + 1 }, (_, index) => YEAR_NOW - index);
const PRICES = [
  10_000, 20_000, 30_000, 40_000, 50_000, 70_000, 100_000, 150_000, 200_000, 300_000, 500_000,
];

const selectClass = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm";

/** Короткий шит для кнопок «Год» и «Цена» — как в мобильном Avito. */
export function RangeDialog({
  open,
  kind,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  kind: "year" | "price";
  initial: Filters;
  onClose: () => void;
  onApply: (filters: Filters) => void;
}) {
  const { t } = useI18n();
  const minKey = kind === "year" ? "year_min" : "price_min";
  const maxKey = kind === "year" ? "year_max" : "price_max";
  const [min, setMin] = React.useState<number | undefined>(undefined);
  const [max, setMax] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    if (!open) return;
    setMin(initial[minKey]);
    setMax(initial[maxKey]);
  }, [open, initial, minKey, maxKey]);

  const apply = () => {
    const next = { ...initial };
    if (min == null) delete next[minKey];
    else next[minKey] = min;
    if (max == null) delete next[maxKey];
    else next[maxKey] = max;
    onApply(next);
  };

  const values = kind === "year" ? YEARS : PRICES;
  const format = kind === "year" ? (value: number) => String(value) : (value: number) => price(value);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={kind === "year" ? t("list.year") : t("list.price")}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setMin(undefined);
              setMax(undefined);
            }}
          >
            {t("filter.reset")}
          </Button>
          <Button onClick={apply}>{t("filter.show")}</Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">{t("common.from")}</span>
          <select
            className={selectClass}
            value={min ?? ""}
            onChange={(event) => setMin(event.target.value ? Number(event.target.value) : undefined)}
          >
            <option value="">{t("filter.any")}</option>
            {values.map((value) => (
              <option key={value} value={value}>
                {format(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">{t("common.to")}</span>
          <select
            className={selectClass}
            value={max ?? ""}
            onChange={(event) => setMax(event.target.value ? Number(event.target.value) : undefined)}
          >
            <option value="">{t("filter.any")}</option>
            {values.map((value) => (
              <option key={value} value={value}>
                {format(value)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Dialog>
  );
}
