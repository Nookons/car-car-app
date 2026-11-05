"use client";

import * as React from "react";
import { SlidersHorizontal } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { FilterDialog } from "@/components/filter-dialog";
import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { filtersToQuery, loadFilters, saveFilters } from "@/lib/filters";
import { filtersSummary, num } from "@/lib/format";
import type { Filters, Listing } from "@/lib/types";

export default function ListPage() {
  const { token, ready } = useAuth();
  const [filters, setFilters] = React.useState<Filters>({});
  const [items, setItems] = React.useState<Listing[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);

  const fetchPage = React.useCallback(
    async (nextFilters: Filters, offset = 0) => {
      if (!token) return;
      setLoading(true);
      try {
        const data = await api<{ items: Listing[]; total: number }>(
          `/listings?${filtersToQuery(nextFilters, offset)}`,
          { token },
        );
        setTotal(data.total);
        setItems((prev) => (offset === 0 ? data.items : [...prev, ...data.items]));
      } finally {
        setLoading(false);
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
    setOpen(false);
    window.history.replaceState(null, "", "/list");
    void fetchPage(next, 0);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Объявления</h1>
            <p className="text-xs text-muted-foreground">{filtersSummary(filters)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <SlidersHorizontal size={16} />
            Фильтры
          </Button>
        </div>
        {total > 0 ? <p className="text-xs text-muted-foreground">Найдено: {num(total)}</p> : null}
      </div>

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-56" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Ничего не нашлось. Попробуй изменить фильтры.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {items.length < total ? (
        <Button
          variant="outline"
          className="w-full"
          disabled={loading}
          onClick={() => fetchPage(filters, items.length)}
        >
          {loading ? "Загружаю…" : `Показать ещё (${num(total - items.length)})`}
        </Button>
      ) : null}

      <FilterDialog open={open} initial={filters} onClose={() => setOpen(false)} onApply={apply} />
    </div>
  );
}
