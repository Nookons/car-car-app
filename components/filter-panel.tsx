"use client";

import * as React from "react";
import { BookmarkSimple, CaretDown, SlidersHorizontal } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { BodyIcon } from "@/components/body-icon";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/cache";
import { filtersToQuery } from "@/lib/filters";
import { num } from "@/lib/format";
import { labelFor, useI18n } from "@/lib/i18n";
import type { Filters } from "@/lib/types";

const YEAR_NOW = new Date().getFullYear();
const YEARS = Array.from({ length: YEAR_NOW - 1989 }, (_, i) => YEAR_NOW - i);
const PRICES = [10_000, 20_000, 30_000, 40_000, 50_000, 70_000, 100_000, 150_000, 200_000, 300_000, 500_000];
const MILEAGE = [50_000, 100_000, 150_000, 200_000, 250_000, 300_000, 400_000];
const ENGINES = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0];
const BODIES = ["sedan", "hatchback", "wagon", "suv", "coupe"];

type Option = { value: string; count: number };

const select = "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm";

export function FilterPanel({
  initial,
  onApply,
}: {
  initial: Filters;
  onApply: (filters: Filters) => void;
}) {
  const { t } = useI18n();
  const { token } = useAuth();
  const [draft, setDraft] = React.useState<Filters>(initial);

  // Если фильтры применили снаружи (URL/сохранённый поиск) — подхватываем их.
  React.useEffect(() => {
    setDraft(initial);
  }, [initial]);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showMore, setShowMore] = React.useState(false);
  const [total, setTotal] = React.useState<number | null>(null);
  const [countLoading, setCountLoading] = React.useState(true);
  const countSeq = React.useRef(0);
  const [makes, setMakes] = React.useState<Option[]>([]);
  const [models, setModels] = React.useState<Option[]>([]);
  const [options, setOptions] = React.useState<{
    gearboxes: Option[];
    fuels: Option[];
    bodies: Option[];
    drives: Option[];
    colors: Option[];
  }>({ gearboxes: [], fuels: [], bodies: [], drives: [], colors: [] });
  const [saving, setSaving] = React.useState(false);
  const [saveMode, setSaveMode] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  React.useEffect(() => {
    const cachedMakes = cacheGet<Option[]>("makes", 60 * 60_000);
    if (cachedMakes) setMakes(cachedMakes);
    else
      api<{ items: Option[] }>("/filters/makes")
        .then((d) => {
          setMakes(d.items);
          cacheSet("makes", d.items);
        })
        .catch(() => {});

    type Options = { gearboxes: Option[]; fuels: Option[]; bodies: Option[]; drives: Option[]; colors: Option[] };
    const cachedOptions = cacheGet<Options>("options", 60 * 60_000);
    if (cachedOptions) setOptions(cachedOptions);
    else
      api<Options>("/filters/options")
        .then((d) => {
          setOptions(d);
          cacheSet("options", d);
        })
        .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!draft.make) {
      setModels([]);
      return;
    }
    const key = `models:${draft.make}`;
    const cached = cacheGet<Option[]>(key, 60 * 60_000);
    if (cached) {
      setModels(cached);
      return;
    }
    api<{ items: Option[] }>(`/filters/models?make=${encodeURIComponent(draft.make)}`)
      .then((d) => {
        setModels(d.items);
        cacheSet(key, d.items);
      })
      .catch(() => setModels([]));
  }, [draft.make]);

  // Живой счётчик под выбранные параметры — как «Показать 672 382 предложения».
  React.useEffect(() => {
    const id = ++countSeq.current;
    const controller = new AbortController();
    const query = filtersToQuery(draft, 0, 1);
    const cached = cacheGet<number>(`count:${query}`, 60_000);
    if (cached != null) {
      setTotal(cached);
      setCountLoading(false);
    } else {
      setCountLoading(true);
    }
    const timer = setTimeout(async () => {
      try {
        const data = await api<{ total: number }>(`/listings?${query}`, {
          signal: controller.signal,
        });
        if (id === countSeq.current) {
          setTotal(data.total);
          cacheSet(`count:${query}`, data.total);
        }
      } catch {
        if (id === countSeq.current && cached == null) setTotal(null);
      } finally {
        if (id === countSeq.current) setCountLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft]);

  const tab: "all" | "new" | "used" =
    draft.year_min && draft.year_min >= YEAR_NOW - 1
      ? "new"
      : draft.year_max && draft.year_max <= YEAR_NOW - 2
        ? "used"
        : "all";

  const applyTab = (next: "all" | "new" | "used") => {
    setDraft((prev) => {
      const copy = { ...prev };
      delete copy.year_min;
      delete copy.year_max;
      if (next === "new") copy.year_min = YEAR_NOW - 1;
      if (next === "used") copy.year_max = YEAR_NOW - 2;
      return copy;
    });
  };

  const toggleBody = (body: string) => {
    const next = { ...draft, body: draft.body === body ? undefined : body };
    setDraft(next);
    onApply(next);
  };

  const saveSearch = async () => {
    if (!token || !saveName.trim()) return;
    setSaving(true);
    try {
      await api("/subscriptions", {
        method: "POST",
        token,
        body: { name: saveName.trim(), criteria: draft },
      });
      setSaved(true);
      setSaveName("");
      setSaveMode(false);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const tabClass = (active: boolean) =>
    `flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
      active ? "bg-card shadow-sm" : "text-muted-foreground"
    }`;

  return (
    <section className="w-full min-w-0 space-y-3 rounded-2xl border bg-card p-3 md:p-4">
      <div className="flex gap-1 rounded-2xl bg-secondary p-1">
        <button className={tabClass(tab === "all")} onClick={() => applyTab("all")}>
          {t("tab.all")}
        </button>
        <button className={tabClass(tab === "new")} onClick={() => applyTab("new")}>
          {t("tab.new")}
        </button>
        <button className={tabClass(tab === "used")} onClick={() => applyTab("used")}>
          {t("tab.used")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:hidden">
        <Button
          variant="outline"
          className="min-w-0 justify-between px-3"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <span className="truncate">{t("filter.makeModel")}</span>
          <CaretDown size={16} className={`shrink-0 ${showAdvanced ? "rotate-180" : ""}`} />
        </Button>
        <Button
          variant="outline"
          className="min-w-0 px-3"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <SlidersHorizontal size={16} className="shrink-0" />
          <span className="truncate">{t("filter.params")}</span>
        </Button>
      </div>

      <div
        className={`grid grid-cols-2 gap-2 md:grid-cols-3 ${
          showAdvanced ? "" : "hidden md:grid"
        }`}
      >
        <select
          className={select}
          value={draft.make ?? ""}
          onChange={(e) => setDraft((p) => ({ ...p, make: e.target.value || undefined, model: undefined }))}
        >
          <option value="">{t("filter.make")}</option>
          {makes.map((m) => (
            <option key={m.value} value={m.value}>
              {m.value}
            </option>
          ))}
        </select>
        <select
          className={select}
          value={draft.model ?? ""}
          onChange={(e) => set("model", e.target.value || undefined)}
          disabled={!draft.make}
        >
          <option value="">{t("filter.model")}</option>
          {models.map((m) => (
            <option key={m.value} value={m.value}>
              {m.value}
            </option>
          ))}
        </select>
        <select
          className={select}
          value={draft.body ?? ""}
          onChange={(e) => set("body", e.target.value || undefined)}
        >
          <option value="">{t("filter.body")}</option>
          {options.bodies.map((b) => (
            <option key={b.value} value={b.value}>
              {labelFor(t, "body", b.value)}
            </option>
          ))}
        </select>
        <select
          className={select}
          value={draft.gearbox ?? ""}
          onChange={(e) => set("gearbox", e.target.value || undefined)}
        >
          <option value="">{t("filter.gearbox")}</option>
          {options.gearboxes.map((g) => (
            <option key={g.value} value={g.value}>
              {labelFor(t, "gearbox", g.value)}
            </option>
          ))}
        </select>
        <select
          className={select}
          value={draft.fuel ?? ""}
          onChange={(e) => set("fuel", e.target.value || undefined)}
        >
          <option value="">{t("filter.fuel")}</option>
          {options.fuels.map((f) => (
            <option key={f.value} value={f.value}>
              {labelFor(t, "fuel", f.value)}
            </option>
          ))}
        </select>
        <select
          className={select}
          value={draft.drive ?? ""}
          onChange={(e) => set("drive", e.target.value || undefined)}
        >
          <option value="">{t("filter.drive")}</option>
          {options.drives.map((d) => (
            <option key={d.value} value={d.value}>
              {labelFor(t, "drive", d.value)}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-1">
          <select
            className={select}
            value={draft.year_min ?? ""}
            onChange={(e) => set("year_min", e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">{t("filter.yearFrom")}</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            className={select}
            value={draft.year_max ?? ""}
            onChange={(e) => set("year_max", e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">{t("common.to")}</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <select
            className={select}
            value={draft.mileage_min ?? ""}
            onChange={(e) => set("mileage_min", e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">{t("filter.mileage")}</option>
            {MILEAGE.map((km) => (
              <option key={km} value={km}>
                {num(km)}
              </option>
            ))}
          </select>
          <select
            className={select}
            value={draft.mileage_max ?? ""}
            onChange={(e) => set("mileage_max", e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">{t("common.to")}</option>
            {MILEAGE.map((km) => (
              <option key={km} value={km}>
                {num(km)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <select
            className={select}
            value={draft.price_min ?? ""}
            onChange={(e) => set("price_min", e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">{t("filter.priceFrom")}</option>
            {PRICES.map((p) => (
              <option key={p} value={p}>
                {num(p)}
              </option>
            ))}
          </select>
          <select
            className={select}
            value={draft.price_max ?? ""}
            onChange={(e) => set("price_max", e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">{t("common.to")}</option>
            {PRICES.map((p) => (
              <option key={p} value={p}>
                {num(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <select
            className={select}
            value={draft.engine_min ? draft.engine_min / 1000 : ""}
            onChange={(e) => set("engine_min", e.target.value ? Number(e.target.value) * 1000 : undefined)}
          >
            <option value="">{t("filter.engineFromL")}</option>
            {ENGINES.map((v) => (
              <option key={v} value={v}>
                {v.toFixed(1)}
              </option>
            ))}
          </select>
          <select
            className={select}
            value={draft.engine_max ? draft.engine_max / 1000 : ""}
            onChange={(e) => set("engine_max", e.target.value ? Number(e.target.value) * 1000 : undefined)}
          >
            <option value="">{t("filter.engineToL")}</option>
            {ENGINES.map((v) => (
              <option key={v} value={v}>
                {v.toFixed(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showMore ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <select
            className={select}
            value={draft.seller_type ?? ""}
            onChange={(e) => set("seller_type", e.target.value || undefined)}
          >
            <option value="">{t("filter.seller")}</option>
            <option value="private">{t("filter.private")}</option>
            <option value="dealer">{t("filter.dealer")}</option>
          </select>
          <select
            className={select}
            value={draft.color ?? ""}
            onChange={(e) => set("color", e.target.value || undefined)}
          >
            <option value="">{t("filter.color")}</option>
            {options.colors.map((c) => (
              <option key={c.value} value={c.value}>
                {c.value}
              </option>
            ))}
          </select>
          <select
            className={select}
            value={draft.doors ?? ""}
            onChange={(e) => set("doors", e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">{t("filter.doors")}</option>
            {[2, 3, 4, 5, 6].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="no-scrollbar flex w-full min-w-0 gap-2 overflow-x-auto md:hidden">
        {BODIES.map((body) => (
          <button
            key={body}
            onClick={() => toggleBody(body)}
            className={`flex w-20 shrink-0 flex-col items-center gap-1 rounded-xl border p-2 text-[11px] ${
              draft.body === body ? "border-primary bg-secondary" : "bg-card"
            }`}
          >
            <BodyIcon body={body} className="h-7 w-12" />
            {labelFor(t, "body", body)}
          </button>
        ))}
      </div>

      <div className="no-scrollbar flex w-full min-w-0 gap-3 overflow-x-auto pb-1 md:hidden">
        {makes.slice(0, 8).map((make) => (
          <button
            key={make.value}
            onClick={() => {
              const next = { ...draft, make: draft.make === make.value ? undefined : make.value, model: undefined };
              setDraft(next);
              if (draft.make === make.value) onApply(next);
            }}
            className={`flex w-16 shrink-0 flex-col items-center gap-1 text-[11px] ${
              draft.make === make.value ? "opacity-100" : "opacity-80"
            }`}
          >
            <BrandLogo
              make={make.value}
              className={`h-12 w-12 border ${
                draft.make === make.value ? "border-primary" : "border-border"
              }`}
            />
            <span className="truncate w-full text-center">{make.value}</span>
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          onClick={() => setShowMore((v) => !v)}
          className="inline-flex items-center gap-1 text-sm font-medium"
        >
          <CaretDown size={16} className={showMore ? "rotate-180" : ""} />
          {showMore ? t("filter.hideFilters") : t("filter.allFilters")}
        </button>

        <div className="ml-auto flex min-w-0 flex-1 items-center gap-2 md:flex-none">
          {saveMode || saved ? (
            <div className="flex flex-1 gap-2">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder={t("filter.namePrompt")}
                className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
              />
              <Button variant="outline" disabled={saving || !saveName.trim()} onClick={saveSearch}>
                {saved ? t("filter.saved") : t("filter.save")}
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => { setSaveMode(true); setSaveName(""); }}>
              <BookmarkSimple size={18} />
              {t("filter.saveSearch")}
            </Button>
          )}
        </div>
      </div>

      <Button
        className="h-14 w-full rounded-2xl text-base"
        disabled={countLoading}
        onClick={() => onApply(draft)}
      >
        {countLoading
          ? t("filter.counting")
          : t("filter.showCount").replace("{count}", num(total ?? 0))}
      </Button>
    </section>
  );
}
