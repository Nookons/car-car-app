import type { Key } from "./i18n";
import { labelFor } from "./i18n";
import { engineVolume, num, price } from "./format";
import type { Filters } from "./types";

export type FilterChip = {
  id: string;
  label: string;
  /** Убирает из фильтров свою группу целиком (например, и марку, и модель). */
  remove: (filters: Filters) => Filters;
};

function without(filters: Filters, keys: Array<keyof Filters>): Filters {
  const next = { ...filters };
  for (const key of keys) delete next[key];
  return next;
}

function range(
  min: number | null | undefined,
  max: number | null | undefined,
  format: (value: number) => string,
  from: string,
  to: string,
): string {
  if (min != null && max != null) return `${format(min)} – ${format(max)}`;
  if (min != null) return `${from} ${format(min)}`;
  if (max != null) return `${to} ${format(max)}`;
  return "";
}

/** Активные фильтры в виде удаляемых чипов — как строка поиска в мобильном Avito. */
export function activeFilterChips(filters: Filters, t: (key: Key) => string): FilterChip[] {
  const chips: FilterChip[] = [];
  const add = (id: string, label: string, keys: Array<keyof Filters>) => {
    if (label.trim()) chips.push({ id, label, remove: (next) => without(next, keys) });
  };

  if (filters.q) add("q", `«${filters.q}»`, ["q"]);

  add(
    "make",
    [
      filters.make ?? filters.makes?.join(", "),
      filters.model,
    ]
      .filter(Boolean)
      .join(" "),
    ["make", "model", "makes"],
  );

  add(
    "price",
    range(filters.price_min, filters.price_max, (value) => price(value), t("common.from"), t("common.to")),
    ["price_min", "price_max"],
  );

  add(
    "year",
    range(filters.year_min, filters.year_max, (value) => String(value), t("common.from"), t("common.to")),
    ["year_min", "year_max"],
  );

  add(
    "mileage",
    range(
      filters.mileage_min,
      filters.mileage_max,
      (value) => `${num(value)} ${t("filter.radius")}`,
      t("common.from"),
      t("common.to"),
    ),
    ["mileage_min", "mileage_max"],
  );

  add(
    "engine",
    range(
      filters.engine_min,
      filters.engine_max,
      (value) => engineVolume(value, t("unit.volume")),
      t("common.from"),
      t("common.to"),
    ),
    ["engine_min", "engine_max"],
  );

  add(
    "power",
    range(
      filters.power_min,
      filters.power_max,
      (value) => `${num(value)} ${t("unit.power")}`,
      t("common.from"),
      t("common.to"),
    ),
    ["power_min", "power_max"],
  );

  if (filters.published_days) {
    const label =
      filters.published_days === 1
        ? t("fresh.24")
        : filters.published_days === 3
          ? t("fresh.3")
          : filters.published_days === 7
            ? t("fresh.7")
            : t("fresh.days").replace("{days}", String(filters.published_days));
    add("fresh", label, ["published_days"]);
  }

  add(
    "fuel",
    filters.fuel ?? filters.fuels?.map((value) => labelFor(t, "fuel", value)).join(", ") ?? "",
    ["fuel", "fuels"],
  );
  add(
    "gearbox",
    filters.gearbox ??
      filters.gearboxes?.map((value) => labelFor(t, "gearbox", value)).join(", ") ??
      "",
    ["gearbox", "gearboxes"],
  );
  add(
    "body",
    filters.body ?? filters.bodies?.map((value) => labelFor(t, "body", value)).join(", ") ?? "",
    ["body", "bodies"],
  );
  add("drive", labelFor(t, "drive", filters.drive), ["drive"]);
  add("condition", labelFor(t, "condition", filters.condition), ["condition"]);
  add("color", filters.color ?? "", ["color"]);

  add(
    "seller",
    filters.seller_type === "private"
      ? t("filter.private")
      : filters.seller_type === "dealer"
        ? t("filter.dealer")
        : "",
    ["seller_type"],
  );

  add("doors", filters.doors != null ? `${t("filter.doors")}: ${filters.doors}` : "", ["doors"]);
  add("seats", filters.seats != null ? `${t("filter.seats")}: ${filters.seats}` : "", ["seats"]);

  return chips;
}
