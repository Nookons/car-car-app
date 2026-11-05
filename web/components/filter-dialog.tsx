"use client";

import * as React from "react";
import { Crosshair } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Filters } from "@/lib/types";

const FUELS = [
  ["", "Любое"],
  ["petrol", "Бензин"],
  ["diesel", "Дизель"],
  ["hybrid", "Гибрид"],
  ["electric", "Электро"],
  ["lpg", "Газ"],
] as const;

const GEARBOXES = [
  ["", "Любая"],
  ["manual", "Механика"],
  ["automatic", "Автоматическая"],
] as const;

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
  const [geoNote, setGeoNote] = React.useState(initial.lat ? "Геолокация включена" : "");

  React.useEffect(() => {
    if (open) setDraft(initial);
  }, [initial, open]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const askGeo = () => {
    if (!navigator.geolocation) return setGeoNote("Геолокация недоступна");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraft((prev) => ({
          ...prev,
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          radius_km: prev.radius_km ?? 50,
        }));
        setGeoNote("Геолокация включена");
      },
      () => setGeoNote("Не удалось получить локацию"),
      { timeout: 8000 },
    );
  };

  const apply = () => {
    const cleaned: Filters = {};
    Object.entries(draft).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        (cleaned as Record<string, unknown>)[key] = value;
      }
    });
    onApply(cleaned);
  };

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
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">Поиск</span>
          <Input
            value={draft.q ?? ""}
            onChange={(event) => set("q", event.target.value)}
            placeholder="BMW 320d, Passat…"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">Марка</span>
          <Input
            value={draft.make ?? ""}
            onChange={(event) => set("make", event.target.value)}
            placeholder="BMW"
          />
        </label>

        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Цена, zł</span>
          <div className="grid grid-cols-2 gap-2">
            <Input
              inputMode="numeric"
              placeholder="от"
              value={draft.price_min ?? ""}
              onChange={(event) => set("price_min", event.target.value ? Number(event.target.value) : undefined)}
            />
            <Input
              inputMode="numeric"
              placeholder="до"
              value={draft.price_max ?? ""}
              onChange={(event) => set("price_max", event.target.value ? Number(event.target.value) : undefined)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">Год от</span>
            <Input
              inputMode="numeric"
              placeholder="2015"
              value={draft.year_min ?? ""}
              onChange={(event) => set("year_min", event.target.value ? Number(event.target.value) : undefined)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">Пробег до, км</span>
            <Input
              inputMode="numeric"
              placeholder="200000"
              value={draft.mileage_max ?? ""}
              onChange={(event) => set("mileage_max", event.target.value ? Number(event.target.value) : undefined)}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">Топливо</span>
            <select
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              value={draft.fuel ?? ""}
              onChange={(event) => set("fuel", event.target.value || undefined)}
            >
              {FUELS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">КПП</span>
            <select
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              value={draft.gearbox ?? ""}
              onChange={(event) => set("gearbox", event.target.value || undefined)}
            >
              {GEARBOXES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Где искать</span>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={askGeo} className="justify-start">
              <Crosshair size={18} />
              Рядом со мной
            </Button>
            <select
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
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
        </div>
      </div>
    </Dialog>
  );
}
