"use client";

import * as React from "react";
import { Crosshair } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { bodyLabel, fuelLabel, gearboxLabel, num } from "@/lib/format";
import { openLocationSettings, requestLocation } from "@/lib/telegram";
import type { Filters } from "@/lib/types";

const PRICES = [0, 10_000, 20_000, 30_000, 40_000, 50_000, 70_000, 100_000, 150_000, 200_000, 300_000, 500_000];
const MILEAGE = [50_000, 100_000, 150_000, 200_000, 250_000, 300_000, 400_000, 500_000];
const YEARS = Array.from({ length: new Date().getFullYear() - 1989 }, (_, index) => new Date().getFullYear() - index);

type Option = { value: string; count: number };
type Options = {
  gearboxes: Option[];
  fuels: Option[];
  bodies: Option[];
  years: { min: number | null; max: number | null };
  price: { p10: number | null; p90: number | null };
  listings: number;
};

const selectClass = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm";

export function FilterDialog({
  open,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  initial: Filters;
  onClose: () => void;
  onApply: (filters: Filters) => void;
}) {
  const [draft, setDraft] = React.useState<Filters>(initial);
  const [makes, setMakes] = React.useState<Option[]>([]);
  const [models, setModels] = React.useState<Option[]>([]);
  const [options, setOptions] = React.useState<Options | null>(null);
  const [geoNote, setGeoNote] = React.useState(initial.lat ? "Геолокация включена" : "");
  const [geoFailed, setGeoFailed] = React.useState(false);

  React.useEffect(() => {
    if (open) setDraft(initial);
  }, [initial, open]);

  React.useEffect(() => {
    if (!open) return;
    api<{ items: Option[] }>("/filters/makes").then((data) => setMakes(data.items)).catch(() => {});
  }, [open]);

  // модели для выбранной марки
  React.useEffect(() => {
    if (!open || !draft.make) {
      setModels([]);
      return;
    }
    api<{ items: Option[] }>(`/filters/models?make=${encodeURIComponent(draft.make)}`)
      .then((data) => setModels(data.items))
      .catch(() => setModels([]));
  }, [open, draft.make]);

  // опции (КПП, топливо, кузов) для марки/модели
  React.useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams();
    if (draft.make) params.set("make", draft.make);
    if (draft.model) params.set("model", draft.model);
    api<Options>(`/filters/options?${params.toString()}`)
      .then((data) => setOptions(data))
      .catch(() => setOptions(null));
  }, [open, draft.make, draft.model]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const askGeo = async () => {
    try {
      const { lat, lon } = await requestLocation();
      setDraft((prev) => ({ ...prev, lat, lon, radius_km: prev.radius_km ?? 50 }));
      setGeoNote("Геолокация включена");
      setGeoFailed(false);
    } catch {
      setGeoFailed(true);
      setGeoNote("Геолокация выключена — разреши доступ к ней в настройках Telegram.");
    }
  };

  const apply = () => {
    const cleaned: Filters = {};
    Object.entries(draft).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "" && value !== 0) {
        (cleaned as Record<string, unknown>)[key] = value;
      }
    });
    onApply(cleaned);
  };

  const gearboxOptions = options?.gearboxes ?? [];
  const fuelOptions = options?.fuels ?? [];
  const bodyOptions = options?.bodies ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Фильтры"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => setDraft({})}>
            Сбросить
          </Button>
          <Button onClick={apply}>Показать</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">Марка</span>
          <select
            className={selectClass}
            value={draft.make ?? ""}
            onChange={(event) => {
              const make = event.target.value || undefined;
              setDraft((prev) => ({ ...prev, make, model: undefined }));
            }}
          >
            <option value="">Любая марка</option>
            {makes.map((m) => (
              <option key={m.value} value={m.value}>
                {m.value} ({num(m.count)})
              </option>
            ))}
          </select>
        </label>

        {draft.make ? (
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">Модель</span>
            <select
              className={selectClass}
              value={draft.model ?? ""}
              onChange={(event) => set("model", event.target.value || undefined)}
            >
              <option value="">Любая модель</option>
              {models.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.value} ({num(m.count)})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">Цена от</span>
            <select
              className={selectClass}
              value={draft.price_min ?? ""}
              onChange={(event) => set("price_min", event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">Не важно</option>
              {PRICES.filter(Boolean).map((p) => (
                <option key={p} value={p}>
                  {num(p)} zł
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">Цена до</span>
            <select
              className={selectClass}
              value={draft.price_max ?? ""}
              onChange={(event) => set("price_max", event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">Не важно</option>
              {PRICES.filter(Boolean).map((p) => (
                <option key={p} value={p}>
                  {num(p)} zł
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">Год от</span>
            <select
              className={selectClass}
              value={draft.year_min ?? ""}
              onChange={(event) => set("year_min", event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">Не важно</option>
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">Год до</span>
            <select
              className={selectClass}
              value={draft.year_max ?? ""}
              onChange={(event) => set("year_max", event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">Не важно</option>
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">Пробег до</span>
          <select
            className={selectClass}
            value={draft.mileage_max ?? ""}
            onChange={(event) => set("mileage_max", event.target.value ? Number(event.target.value) : undefined)}
          >
            <option value="">Не важно</option>
            {MILEAGE.map((km) => (
              <option key={km} value={km}>
                {num(km)} км
              </option>
            ))}
          </select>
        </label>

        {draft.model ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">Коробка</span>
            <select
              className={selectClass}
              value={draft.gearbox ?? ""}
              onChange={(event) => set("gearbox", event.target.value || undefined)}
            >
              <option value="">Любая</option>
              {gearboxOptions.map((g) => (
                <option key={g.value} value={g.value}>
                  {gearboxLabel(g.value)} ({num(g.count)})
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">Топливо</span>
            <select
              className={selectClass}
              value={draft.fuel ?? ""}
              onChange={(event) => set("fuel", event.target.value || undefined)}
            >
              <option value="">Любое</option>
              {fuelOptions.map((f) => (
                <option key={f.value} value={f.value}>
                  {fuelLabel(f.value)} ({num(f.count)})
                </option>
              ))}
            </select>
          </label>
        </div>

        ) : (
          <p className="rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
            Выбери марку и модель — покажем коробки, топливо и кузова, которые для них бывают.
          </p>
        )}

        {draft.model && bodyOptions.length > 0 ? (
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">Кузов</span>
            <select
              className={selectClass}
              value={draft.body ?? ""}
              onChange={(event) => set("body", event.target.value || undefined)}
            >
              <option value="">Любой</option>
              {bodyOptions.map((b) => (
                <option key={b.value} value={b.value}>
                  {bodyLabel(b.value)} ({num(b.count)})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Где искать</span>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={askGeo} className="justify-start">
              <Crosshair size={18} />
              Рядом со мной
            </Button>
            <select
              className={selectClass}
              value={draft.radius_km ?? 50}
              onChange={(event) => set("radius_km", Number(event.target.value))}
              disabled={!draft.lat}
            >
              {[25, 50, 100, 200].map((km) => (
                <option key={km} value={km}>
                  {km} км
                </option>
              ))}
            </select>
          </div>
          {geoNote ? <p className="text-xs text-muted-foreground">{geoNote}</p> : null}
          {geoFailed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!openLocationSettings()) {
                  setGeoNote("Открой Telegram → Настройки → Данные и память → Геоданные");
                }
              }}
            >
              Открыть настройки Telegram
            </Button>
          ) : null}
        </div>

        {options ? (
          <p className="text-[11px] text-muted-foreground">
            Опции собраны из {num(options.listings)} объявлений в нашей базе
            {draft.make ? ` · ${draft.make}` : ""}
            {draft.model ? ` ${draft.model}` : ""}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
