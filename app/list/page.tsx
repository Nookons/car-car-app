"use client";

import * as React from "react";
import { useAuth } from "@/components/auth-provider";
import { FilterPanel } from "@/components/filter-panel";
import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { filtersToQuery, loadFilters, saveFilters } from "@/lib/filters";
import { num } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Filters, Listing } from "@/lib/types";

export default function ListPage() {
  const { token, ready } = useAuth();
  const { t } = useI18n();
  const [filters, setFilters] = React.useState<Filters>({});
  const [items, setItems] = React.useState<Listing[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const seq = React.useRef(0);
  const abortRef = React.useRef<AbortController | null>(null);

  const fetchPage = React.useCallback(
    async (next: Filters, offset = 0) => {
      if (!token) return;
      // Новый запрос отменяет предыдущий: старый ответ не перетрёт новый.
      const id = ++seq.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      if (offset === 0) {
        setLoading(true);
        setItems([]);
        setTotal(0);
      } else {
        setLoadingMore(true);
      }
      try {
        const data = await api<{ items: Listing[]; total: number }>(
          `/listings?${filtersToQuery(next, offset)}`,
          { token, signal: controller.signal },
        );
        if (id !== seq.current) return;
        setTotal(data.total);
        setItems((prev) => (offset === 0 ? data.items : [...prev, ...data.items]));
      } catch (exc) {
        if (controller.signal.aborted) return;
        if (id === seq.current) setError(exc instanceof Error ? exc.message : "error");
      } finally {
        if (id === seq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [token],
  );

  React.useEffect(() => {
    if (!ready || !token) return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl: Filters = {};
    params.forEach((value, key) => {
      if (["limit", "offset", "sort"].includes(key)) return;
      (fromUrl as Record<string, unknown>)[key] = Number.isNaN(Number(value)) ? value : Number(value);
    });
    const initial = Object.keys(fromUrl).length ? fromUrl : loadFilters();
    setFilters(initial);
    saveFilters(initial);
    void fetchPage(initial, 0);
  }, [ready, token, fetchPage]);

  const apply = (next: Filters) => {
    setFilters(next);
    saveFilters(next);
    setItems([]);
    setTotal(0);
    setLoading(true);
    window.history.replaceState(null, "", "/list");
    window.scrollTo({ top: 0, behavior: "smooth" });
    void fetchPage(next, 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">{t("list.title")}</h1>
        {total > 0 ? (
          <span className="text-xs text-muted-foreground">
            {t("list.found")}: {num(total)}
          </span>
        ) : null}
      </div>

      <FilterPanel initial={filters} onApply={apply} />

      {error ? (
        <div className="space-y-3 rounded-2xl border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => fetchPage(filters, 0)}>
            {t("common.retry")}
          </Button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-56" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("list.empty")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {loadingMore ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-56" />
          ))}
        </div>
      ) : null}

      {items.length < total ? (
        <Button
          variant="outline"
          className="w-full"
          disabled={loadingMore}
          onClick={() => fetchPage(filters, items.length)}
        >
          {loadingMore ? t("list.loading") : `${t("list.more")} (${num(total - items.length)})`}
        </Button>
      ) : null}
    </div>
  );
}
