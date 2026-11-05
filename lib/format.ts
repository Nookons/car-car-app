export function price(value: number | null | undefined, currency = "PLN") {
  if (value == null) return "—";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function num(value: number | null | undefined) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

export function date(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const FUEL: Record<string, string> = {
  petrol: "Бензин",
  diesel: "Дизель",
  hybrid: "Гибрид",
  plugin_hybrid: "Гибрид plug-in",
  electric: "Электро",
  lpg: "Газ",
  cng: "CNG",
  other: "Другое",
};

const GEARBOX: Record<string, string> = {
  manual: "Механика",
  automatic: "Автоматическая",
  semi_auto: "Полуавтомат",
  other: "Другое",
};

export const fuelLabel = (value: string | null) => (value ? FUEL[value] ?? value : "");
export const gearboxLabel = (value: string | null) => (value ? GEARBOX[value] ?? value : "");

export function filtersSummary(filters: Filters): string {
  const parts: string[] = [];
  if (filters.make) parts.push(filters.make);
  if (filters.price_max) parts.push(`до ${num(filters.price_max)} zł`);
  if (filters.year_min) parts.push(`от ${filters.year_min} г.`);
  if (filters.mileage_max) parts.push(`до ${num(filters.mileage_max)} км`);
  if (filters.gearbox) parts.push(gearboxLabel(filters.gearbox));
  if (filters.radius_km) parts.push(`до ${filters.radius_km} км`);
  return parts.join(" · ") || "Все объявления";
}

import type { Filters } from "./types";
