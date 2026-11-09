"use client";

import * as React from "react";
import {
  ArrowsDownUp,
  CaretDown,
  MagnifyingGlass,
  MapPin,
  SlidersHorizontal,
  X,
} from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { FilterDialog } from "@/components/filter-dialog";
import { ListingRow } from "@/components/listing-row";
import { RangeDialog } from "@/components/range-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { activeFilterChips } from "@/lib/filter-chips";
import { filtersToQuery, loadFilters, saveFilters } from "@/lib/filters";
import { num, price } from "@/lib/format";
import { useI18n, type Lang } from "@/lib/i18n";
import type { Filters, Listing } from "@/lib/types";

const CACHE_KEY = "list";
const RADII = [25, 50, 100, 200];
const FRESH = [
  { days: 1, key: "fresh.24" },
  { days: 3, key: "fresh.3" },
  { days: 7, key: "fresh.7" },
] as const;

const TEXT_KEYS = new Set([
  "q",
  "make",
  "model",
  "fuel",
  "gearbox",
  "body",
  "drive",
  "condition",
  "seller_type",
  "color",
  "sort",
]);

const NUMBER_KEYS = new Set([
  "price_min",
  "price_max",
  "year_min",
  "year_max",
  "mileage_min",
  "mileage_max",
  "doors",
  "seats",
  "power_min",
  "power_max",
  "engine_min",
  "engine_max",
  "lat",
  "lon",
  "radius_km",
  "published_days",
]);

type CachedList = {
  filters: Filters;
  items: Listing[];
  total: number;
  approx: boolean;
  scroll: number;
};

function readFiltersFromUrl(): Filters | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const out: Record<string, string | number> = {};
  params.forEach((value, key) => {
    if (!value) return;
    if (key === "sort") {
      if (["new", "price_asc", "price_desc", "distance"].includes(value)) out.sort = value;
      return;
    }
    if (NUMBER_KEYS.has(key)) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) out[key] = parsed;
      return;
    }
    if (TEXT_KEYS.has(key)) out[key] = value;
  });
  if (out.lat != null && out.lon != null) {
    if (out.radius_km == null) out.radius_km = 50;
  } else {
    delete out.radius_km;
  }
  return Object.keys(out).length ? (out as unknown as Filters) : null;
}

function listUrl(filters: Filters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `/list?${query}` : "/list";
}

function resultsLabel(
  t: ReturnType<typeof useI18n>["t"],
  lang: Lang,
  count: number,
  approx = false,
): string {
  const value = `${num(count)}${approx ? "+" : ""}`;
  const mod10 = count % 10;
  const mod100 = count % 100;
  const few = mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14);

  if (lang === "ru" || lang === "uk") {
    if (mod10 === 1 && mod100 !== 11) return t("list.resultsOne").replace("{count}", value);
    if (few) return t("list.resultsFew").replace("{count}", value);
    return t("list.resultsMany").replace("{count}", value);
  }
  if (lang === "pl") {
    if (count === 1) return t("list.resultsOne").replace("{count}", value);
    if (few) return t("list.resultsFew").replace("{count}", value);
    return t("list.resultsMany").replace("{count}", value);
  }
  return (count === 1 ? t("list.resultsOne") : t("list.resultsMany")).replace("{count}", value);
}

export default function ListPage() {
  const { token, ready } = useAuth();
  const { t, lang } = useI18n();
  const [filters, setFilters] = React.useState<Filters>({});
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<Listing[]>([]);
  const [total, setTotal] = React.useState(0);
  const [approx, setApprox] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [rangeKind, setRangeKind] = React.useState<"year" | "price" | null>(null);
  const [paramsFocus, setParamsFocus] = React.useState<"location" | undefined>(undefined);
  const seq = React.useRef(0);
  const abortRef = React.useRef<AbortController | null>(null);
  const started = React.useRef(false);
  const applyRef = React.useRef<(next: Filters) => void>(() => {});
  const stateRef = React.useRef({ filters, items, total, approx });
  stateRef.current = { filters, items, total, approx };

  React.useEffect(() => {
    setQuery(filters.q ?? "");
  }, [filters.q]);

  const fetchPage = React.useCallback(
    async (next: Filters, offset = 0, background = false) => {
      const id = ++seq.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (!background) {
        setError(null);
        if (offset === 0) {
          setLoading(true);
          setItems([]);
          setTotal(0);
        } else {
          setLoadingMore(true);
        }
      }
      try {
        const data = await api<{ items: Listing[]; total: number; approx?: boolean }>(
          `/listings?${filtersToQuery(next, offset)}`,
          { token: token ?? undefined, signal: controller.signal },
        );
        if (id !== seq.current) return;
        setTotal(data.total);
        setApprox(Boolean(data.approx));
        setItems((prev) => (offset === 0 ? data.items : [...prev, ...data.items]));
        cacheSet<CachedList>(CACHE_KEY, {
          filters: next,
          items: offset === 0 ? data.items : [...stateRef.current.items, ...data.items],
          total: data.total,
          approx: Boolean(data.approx),
          scroll: offset === 0 ? 0 : window.scrollY,
        });
      } catch (exc) {
        if (controller.signal.aborted) return;
        if (id === seq.current && !background) {
          setError(exc instanceof Error ? exc.message : "error");
        }
      } finally {
        if (id === seq.current && !background) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [token],
  );

  // Гидратация: ссылка из «Главной» важнее кэша, кэш важнее сохранённых фильтров.
  React.useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const fromUrl = readFiltersFromUrl();
    if (fromUrl) {
      setFilters(fromUrl);
      saveFilters(fromUrl);
      void fetchPage(fromUrl, 0);
      return;
    }
    const cached = cacheGet<CachedList>(CACHE_KEY, 30 * 60_000);
    if (cached) {
      setFilters(cached.filters);
      setItems(cached.items);
      setTotal(cached.total);
      setApprox(cached.approx ?? false);
      setLoading(false);
      requestAnimationFrame(() => window.scrollTo(0, cached.scroll));
      void fetchPage(cached.filters, 0, true);
      return;
    }
    const initial = loadFilters();
    setFilters(initial);
    void fetchPage(initial, 0);
  }, [ready, fetchPage]);

  // Позицию прокрутки сохраняем, чтобы возврат из объявления был на месте.
  React.useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const { filters: f, items: list, total: sum, approx: approximate } = stateRef.current;
        cacheSet<CachedList>(CACHE_KEY, {
          filters: f,
          items: list,
          total: sum,
          approx: approximate,
          scroll: window.scrollY,
        });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      const { filters: f, items: list, total: sum, approx: approximate } = stateRef.current;
      if (list.length) {
        cacheSet<CachedList>(CACHE_KEY, {
          filters: f,
          items: list,
          total: sum,
          approx: approximate,
          scroll: window.scrollY,
        });
      }
    };
  }, []);

  const apply = React.useCallback(
    (next: Filters) => {
      setFilters(next);
      saveFilters(next);
      setDialogOpen(false);
      setRangeKind(null);
      setParamsFocus(undefined);
      window.history.replaceState(null, "", listUrl(next));
      window.scrollTo({ top: 0, behavior: "smooth" });
      void fetchPage(next, 0);
    },
    [fetchPage],
  );

  applyRef.current = apply;

  // Текст ищем с паузой: не дёргаем API на каждую букву.
  React.useEffect(() => {
    if (!started.current) return;
    const next = query.trim();
    if ((stateRef.current.filters.q ?? "") === next) return;
    const timer = window.setTimeout(() => {
      applyRef.current({ ...stateRef.current.filters, q: next || undefined });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [query]);

  const changeSort = (sort: Filters["sort"]) => {
    const next = { ...filters, sort };
    setFilters(next);
    saveFilters(next);
    window.history.replaceState(null, "", listUrl(next));
    void fetchPage(next, 0);
  };

  const chips = activeFilterChips(filters, t);
  const sort = filters.sort ?? "new";
  const near = filters.lat != null && filters.lon != null;
  const radius = filters.radius_km ?? 50;
  const advancedCount = Object.entries(filters).filter(
    ([key, value]) =>
      ![
        "sort",
        "lat",
        "lon",
        "make",
        "model",
        "price_min",
        "price_max",
        "year_min",
        "year_max",
        "published_days",
      ].includes(key) &&
      value !== undefined &&
      value !== null &&
      value !== "",
  ).length;

  const yearValue =
    filters.year_min != null && filters.year_max != null
      ? `${filters.year_min}–${filters.year_max}`
      : filters.year_min != null
        ? `${t("common.from")} ${filters.year_min}`
        : filters.year_max != null
          ? `${t("common.to")} ${filters.year_max}`
          : "";

  const priceValue =
    filters.price_min != null && filters.price_max != null
      ? `${price(filters.price_min)} – ${price(filters.price_max)}`
      : filters.price_min != null
        ? `${t("common.from")} ${price(filters.price_min)}`
        : filters.price_max != null
          ? `${t("common.to")} ${price(filters.price_max)}`
          : "";

  const quickClass = (active: boolean) =>
    `flex h-11 min-w-0 items-center justify-between gap-1 rounded-xl border px-3 text-[13px] font-medium transition ${
      active ? "border-foreground/20 bg-secondary" : "bg-card hover:bg-secondary/60"
    }`;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3">
      <h1 className="px-1 text-xl font-semibold tracking-tight">{t("list.title")}</h1>

      <div className="relative px-1">
        <MagnifyingGlass
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            apply({ ...filters, q: query.trim() || undefined });
          }}
          placeholder={t("list.searchPlaceholder")}
          aria-label={t("list.search")}
          maxLength={80}
          enterKeyHint="search"
          autoComplete="off"
          className="pl-11 pr-10"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              apply({ ...filters, q: undefined });
            }}
            aria-label={t("list.clear")}
            className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => apply(chip.remove(filters))}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-secondary px-3 text-xs font-medium"
            >
              <span className="max-w-[240px] truncate">{chip.label}</span>
              <X size={14} className="shrink-0 text-muted-foreground" />
            </button>
          ))}
          {chips.length > 1 ? (
            <button
              type="button"
              onClick={() => apply({})}
              className="inline-flex h-9 shrink-0 items-center px-2 text-xs font-medium text-muted-foreground underline underline-offset-2"
            >
              {t("list.clear")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => setRangeKind("year")} className={quickClass(!!yearValue)}>
          <span className="truncate">{yearValue || t("list.year")}</span>
          <CaretDown size={14} className="shrink-0 text-muted-foreground" />
        </button>
        <button type="button" onClick={() => setRangeKind("price")} className={quickClass(!!priceValue)}>
          <span className="truncate">{priceValue || t("list.price")}</span>
          <CaretDown size={14} className="shrink-0 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={() => {
            setParamsFocus(undefined);
            setDialogOpen(true);
          }}
          className={`${quickClass(advancedCount > 0)} relative`}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <SlidersHorizontal size={15} className="shrink-0" />
            <span className="truncate">{t("filter.params")}</span>
          </span>
          {advancedCount > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {advancedCount}
            </span>
          ) : null}
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          setParamsFocus("location");
          setDialogOpen(true);
        }}
        className="flex w-full items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-left transition hover:bg-secondary/60"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <MapPin size={16} className="shrink-0 text-muted-foreground" />
          <span className="truncate">
            {near
              ? `${t("list.locationNear")} · ${radius} ${t("filter.radius")}`
              : t("list.locationAll")}
          </span>
        </span>
        <CaretDown size={16} className="shrink-0 text-muted-foreground" />
      </button>

      {near ? (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {RADII.map((km) => {
            const active = radius === km;
            return (
              <button
                key={km}
                type="button"
                onClick={() => apply({ ...filters, radius_km: km })}
                className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-medium transition ${
                  active
                    ? "border-foreground/30 bg-secondary text-foreground"
                    : "bg-card text-muted-foreground hover:bg-secondary/60"
                }`}
              >
                {km} {t("filter.radius")}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {FRESH.map((item) => {
          const active = filters.published_days === item.days;
          return (
            <button
              key={item.days}
              type="button"
              aria-pressed={active}
              onClick={() =>
                apply({ ...filters, published_days: active ? undefined : item.days })
              }
              className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-medium transition ${
                active
                  ? "border-foreground/30 bg-secondary text-foreground"
                  : "bg-card text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              {t(item.key)}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm text-muted-foreground">
          {loading && total === 0 ? t("filter.counting") : resultsLabel(t, lang, total, approx)}
        </p>
        <label className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border bg-card px-2.5 py-2 text-xs font-medium">
          <ArrowsDownUp size={16} className="shrink-0 text-muted-foreground" />
          <select
            value={sort}
            onChange={(event) => changeSort(event.target.value as Filters["sort"])}
            aria-label={t("list.sort")}
            className="max-w-[140px] appearance-none bg-transparent pr-0.5 outline-none"
          >
            <option value="new">{t("sort.new")}</option>
            <option value="price_asc">{t("sort.price_asc")}</option>
            <option value="price_desc">{t("sort.price_desc")}</option>
            <option value="distance" disabled={!near}>
              {t("sort.distance")}
            </option>
            <option value="year_desc">{t("sort.year_desc")}</option>
            <option value="mileage_asc">{t("sort.mileage_asc")}</option>
          </select>
        </label>
      </div>

      {error && items.length === 0 ? (
        <div className="space-y-3 rounded-2xl border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => fetchPage(filters, 0)}>
            {t("common.retry")}
          </Button>
        </div>
      ) : loading ? (
        <div className="-mx-4 space-y-3 md:mx-0">
          {Array.from({ length: 4 }).map((_, index) => (
            <ListSkeleton key={index} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("list.empty")}</p>
      ) : (
        <div className="-mx-4 space-y-3 md:mx-0">
          {items.map((item, index) => (
            <ListingRow key={item.id} item={item} priority={index < 2} />
          ))}
        </div>
      )}

      {error && items.length > 0 ? (
        <p className="px-1 text-center text-xs text-destructive">{error}</p>
      ) : null}

      {loadingMore ? (
        <div className="-mx-4 space-y-3 md:mx-0">
          {Array.from({ length: 2 }).map((_, index) => (
            <ListSkeleton key={index} />
          ))}
        </div>
      ) : null}

      {items.length < total ? (
        <Button
          variant="outline"
          className="h-12 w-full rounded-xl"
          disabled={loadingMore}
          onClick={() => fetchPage(filters, items.length)}
        >
          {loadingMore
            ? t("list.loading")
            : approx
              ? t("list.more")
              : `${t("list.more")} (${num(total - items.length)})`}
        </Button>
      ) : null}

      <RangeDialog
        open={rangeKind !== null}
        kind={rangeKind ?? "year"}
        initial={filters}
        onClose={() => setRangeKind(null)}
        onApply={apply}
      />

      <FilterDialog
        open={dialogOpen}
        initial={filters}
        title={t("filter.params")}
        focus={paramsFocus}
        onClose={() => {
          setDialogOpen(false);
          setParamsFocus(undefined);
        }}
        onApply={apply}
      />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="overflow-hidden border border-x-0 bg-card md:rounded-2xl md:border-x">
      <div className="space-y-2.5 p-4 pr-12">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-6 w-2/5" />
      </div>
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
