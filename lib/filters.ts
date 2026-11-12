import type { Filters } from "./types";

const KEY = "carcar.filters";

export function loadFilters(): Filters {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Filters;
  } catch {
    return {};
  }
}

export function saveFilters(filters: Filters): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(filters));
}

export function filtersToQuery(filters: Filters, offset = 0, limit = 20): string {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    sort: filters.sort ?? "new",
  });
  Object.entries(filters).forEach(([key, value]) => {
    if (key === "sort") return;
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== "") {
          params.append(key, String(item));
        }
      }
      return;
    }
    params.set(key, String(value));
  });
  return params.toString();
}
