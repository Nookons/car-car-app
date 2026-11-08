"use client";

import * as React from "react";
import { Crosshair } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { num } from "@/lib/format";
import { labelFor, useI18n } from "@/lib/i18n";
import { openLocationSettings, requestLocation } from "@/lib/telegram";
import type { Filters } from "@/lib/types";

const PRICES = [10_000, 20_000, 30_000, 40_000, 50_000, 70_000, 100_000, 150_000, 200_000, 300_000, 500_000];
const MILEAGE = [50_000, 100_000, 150_000, 200_000, 250_000, 300_000, 400_000, 500_000];
const YEARS = Array.from({ length: new Date().getFullYear() - 1989 }, (_, index) => new Date().getFullYear() - index);

type Option = { value: string; count: number };
type City = { value: string; lat: number; lon: number; count: number };
type Options = {
  gearboxes: Option[];
  fuels: Option[];
  bodies: Option[];
  drives: Option[];
  conditions: Option[];
  colors: Option[];
  years: { min: number | null; max: number | null };
  price: { p10: number | null; p90: number | null };
  listings: number;
};

const selectClass = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm";

export function FilterDialog({
  open,
  initial,
  title,
  focus,
  onClose,
  onApply,
}: {
  open: boolean;
  initial: Filters;
  title?: string;
  focus?: "location";
  onClose: () => void;
  onApply: (filters: Filters) => void;
}) {
  const { t } = useI18n();
  const { token } = useAuth();
  const [draft, setDraft] = React.useState<Filters>(initial);
  const [makes, setMakes] = React.useState<Option[]>([]);
  const [models, setModels] = React.useState<Option[]>([]);
  const [options, setOptions] = React.useState<Options | null>(null);
  const [cities, setCities] = React.useState<City[]>([]);
  const [pickedCity, setPickedCity] = React.useState("");
  const [geoActive, setGeoActive] = React.useState(Boolean(initial.lat && initial.lon));
  const [geoNote, setGeoNote] = React.useState(initial.lat ? t("filter.calibrated") : "");
  const [geoFailed, setGeoFailed] = React.useState(false);
  const [saveMode, setSaveMode] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const locationRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setDraft(initial);
    const hasGeo = initial.lat != null && initial.lon != null;
    setGeoActive(hasGeo);
    setGeoNote(hasGeo ? t("filter.calibrated") : "");
    setGeoFailed(false);
  }, [initial, open]);

  React.useEffect(() => {
    if (!open || focus !== "location") return;
    const timer = setTimeout(() => {
      locationRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 80);
    return () => clearTimeout(timer);
  }, [open, focus]);

  React.useEffect(() => {
    if (!open) return;
    api<{ items: Option[] }>("/filters/makes").then((data) => setMakes(data.items)).catch(() => {});
    api<{ items: City[] }>("/filters/cities")
      .then((data) => setCities(data.items))
      .catch(() => setCities([]));
  }, [open]);

  React.useEffect(() => {
    if (!open || !draft.make) {
      setModels([]);
      return;
    }
    api<{ items: Option[] }>(`/filters/models?make=${encodeURIComponent(draft.make)}`)
      .then((data) => setModels(data.items))
      .catch(() => setModels([]));
  }, [open, draft.make]);

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
    setGeoNote(t("filter.detecting"));
    setGeoFailed(false);
    try {
      const { lat, lon } = await requestLocation();
      setDraft((prev) => ({ ...prev, lat, lon, radius_km: prev.radius_km ?? 50 }));
      setPickedCity("");
      setGeoActive(true);
      setGeoFailed(false);
      setGeoNote(t("filter.calibrated"));
    } catch {
      setGeoActive(false);
      setGeoFailed(true);
      setGeoNote(t("filter.geoOff"));
    }
  };

  const apply = () => {
    const cleaned: Filters = {};
    Object.entries(draft).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "" && value !== 0) {
        (cleaned as Record<string, unknown>)[key] = value;
      }
    });
    if (cleaned.lat == null || cleaned.lon == null) {
      delete cleaned.radius_km;
      delete cleaned.lat;
      delete cleaned.lon;
    }
    onApply(cleaned);
  };

  const gearboxOptions = options?.gearboxes ?? [];
  const fuelOptions = options?.fuels ?? [];
  const bodyOptions = options?.bodies ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title ?? t("filter.title")}
      footer={
        saveMode ? (
          <div className="space-y-2">
            <input
              autoFocus
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              placeholder={t("filter.namePrompt")}
              maxLength={120}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setSaveMode(false)}>
                {t("filter.reset")}
              </Button>
              <Button
                disabled={!saveName.trim()}
                onClick={async () => {
                  if (!token) return;
                  await api("/subscriptions", {
                    method: "POST",
                    token,
                    body: { name: saveName.trim(), criteria: draft },
                  });
                  setSaveMode(false);
                  setSaveName("");
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2500);
                }}
              >
                {saved ? t("filter.saved") : t("filter.save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setDraft({})}>
                {t("filter.reset")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSaveName(
                    [draft.make, draft.model, draft.price_max ? `≤ ${num(draft.price_max)} zł` : ""]
                      .filter(Boolean)
                      .join(" ") || t("filter.save"),
                  );
                  setSaveMode(true);
                }}
              >
                {t("filter.save")}
              </Button>
            </div>
            <Button className="w-full" onClick={apply}>
              {t("filter.show")}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">{t("filter.make")}</span>
          <select
            className={selectClass}
            value={draft.make ?? ""}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, make: event.target.value || undefined, model: undefined }))
            }
          >
            <option value="">{t("filter.anyMake")}</option>
            {makes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.value} ({num(item.count)})
              </option>
            ))}
          </select>
        </label>

        {draft.make ? (
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.model")}</span>
            <select
              className={selectClass}
              value={draft.model ?? ""}
              onChange={(event) => set("model", event.target.value || undefined)}
            >
              <option value="">{t("filter.anyModel")}</option>
              {models.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.value} ({num(item.count)})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.priceFrom")}</span>
            <select
              className={selectClass}
              value={draft.price_min ?? ""}
              onChange={(event) => set("price_min", event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">{t("filter.any")}</option>
              {PRICES.map((value) => (
                <option key={value} value={value}>
                  {num(value)} zł
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.priceTo")}</span>
            <select
              className={selectClass}
              value={draft.price_max ?? ""}
              onChange={(event) => set("price_max", event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">{t("filter.any")}</option>
              {PRICES.map((value) => (
                <option key={value} value={value}>
                  {num(value)} zł
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.yearFrom")}</span>
            <select
              className={selectClass}
              value={draft.year_min ?? ""}
              onChange={(event) => set("year_min", event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">{t("filter.any")}</option>
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.yearTo")}</span>
            <select
              className={selectClass}
              value={draft.year_max ?? ""}
              onChange={(event) => set("year_max", event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">{t("filter.any")}</option>
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">{t("filter.mileage")}</span>
          <select
            className={selectClass}
            value={draft.mileage_max ?? ""}
            onChange={(event) => set("mileage_max", event.target.value ? Number(event.target.value) : undefined)}
          >
            <option value="">{t("filter.any")}</option>
            {MILEAGE.map((km) => (
              <option key={km} value={km}>
                {num(km)} {t("filter.radius")}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.gearbox")}</span>
            <select
              className={selectClass}
              value={draft.gearbox ?? ""}
              onChange={(event) => set("gearbox", event.target.value || undefined)}
            >
              <option value="">{t("filter.anyGearbox")}</option>
              {gearboxOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {labelFor(t, "gearbox", item.value)} ({num(item.count)})
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.fuel")}</span>
            <select
              className={selectClass}
              value={draft.fuel ?? ""}
              onChange={(event) => set("fuel", event.target.value || undefined)}
            >
              <option value="">{t("filter.anyFuel")}</option>
              {fuelOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {labelFor(t, "fuel", item.value)} ({num(item.count)})
                </option>
              ))}
            </select>
          </label>
        </div>

        {bodyOptions.length > 0 ? (
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.body")}</span>
            <select
              className={selectClass}
              value={draft.body ?? ""}
              onChange={(event) => set("body", event.target.value || undefined)}
            >
              <option value="">{t("filter.anyBody")}</option>
              {bodyOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {labelFor(t, "body", item.value)} ({num(item.count)})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.drive")}</span>
            <select
              className={selectClass}
              value={draft.drive ?? ""}
              onChange={(event) => set("drive", event.target.value || undefined)}
            >
              <option value="">{t("filter.anyDrive")}</option>
              {(options?.drives ?? []).map((item) => (
                <option key={item.value} value={item.value}>
                  {labelFor(t, "drive", item.value)} ({num(item.count)})
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.condition")}</span>
            <select
              className={selectClass}
              value={draft.condition ?? ""}
              onChange={(event) => set("condition", event.target.value || undefined)}
            >
              <option value="">{t("filter.anyCondition")}</option>
              {(options?.conditions ?? []).map((item) => (
                <option key={item.value} value={item.value}>
                  {labelFor(t, "condition", item.value)} ({num(item.count)})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.seller")}</span>
            <select
              className={selectClass}
              value={draft.seller_type ?? ""}
              onChange={(event) => set("seller_type", event.target.value || undefined)}
            >
              <option value="">{t("filter.anySeller")}</option>
              <option value="private">{t("filter.private")}</option>
              <option value="dealer">{t("filter.dealer")}</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.color")}</span>
            <select
              className={selectClass}
              value={draft.color ?? ""}
              onChange={(event) => set("color", event.target.value || undefined)}
            >
              <option value="">{t("filter.anyColor")}</option>
              {(options?.colors ?? []).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.value} ({num(item.count)})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.doors")}</span>
            <select
              className={selectClass}
              value={draft.doors ?? ""}
              onChange={(event) => set("doors", event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">{t("filter.any")}</option>
              {[2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.seats")}</span>
            <select
              className={selectClass}
              value={draft.seats ?? ""}
              onChange={(event) => set("seats", event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">{t("filter.any")}</option>
              {[2, 4, 5, 6, 7, 8].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.powerFrom")}</span>
            <select
              className={selectClass}
              value={draft.power_min ?? ""}
              onChange={(event) => set("power_min", event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">{t("filter.any")}</option>
              {[50, 100, 150, 200, 250, 300, 400, 500].map((value) => (
                <option key={value} value={value}>
                  {value} KM
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.powerTo")}</span>
            <select
              className={selectClass}
              value={draft.power_max ?? ""}
              onChange={(event) => set("power_max", event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">{t("filter.any")}</option>
              {[100, 150, 200, 250, 300, 400, 500, 700].map((value) => (
                <option key={value} value={value}>
                  {value} KM
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.engineFrom")}</span>
            <select
              className={selectClass}
              value={draft.engine_min ?? ""}
              onChange={(event) => set("engine_min", event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">{t("filter.any")}</option>
              {[900, 1200, 1600, 2000, 2500, 3000].map((value) => (
                <option key={value} value={value}>
                  {value} cm³
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.engineTo")}</span>
            <select
              className={selectClass}
              value={draft.engine_max ?? ""}
              onChange={(event) => set("engine_max", event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">{t("filter.any")}</option>
              {[1200, 1600, 2000, 2500, 3000, 4000, 5000].map((value) => (
                <option key={value} value={value}>
                  {value} cm³
                </option>
              ))}
            </select>
          </label>
        </div>

        {!draft.model ? (
          <p className="text-xs text-muted-foreground">{t("filter.optionsAll")}</p>
        ) : null}

        <div ref={locationRef} className="space-y-1.5 scroll-mt-2">
          <span className="text-xs text-muted-foreground">{t("filter.where")}</span>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("filter.city")}</span>
            <select
              className={selectClass}
              value={pickedCity}
              onChange={(event) => {
                const name = event.target.value;
                setPickedCity(name);
                const city = cities.find((item) => item.value === name);
                if (city) {
                  setDraft((prev) => ({
                    ...prev,
                    lat: city.lat,
                    lon: city.lon,
                    radius_km: prev.radius_km ?? 50,
                  }));
                  setGeoActive(true);
                  setGeoNote(`${t("filter.calibratedCity")}: ${name}`);
                  setGeoFailed(false);
                } else {
                  setDraft((prev) => ({ ...prev, lat: undefined, lon: undefined }));
                  setGeoActive(false);
                  setGeoNote("");
                }
              }}
            >
              <option value="">{t("filter.noCity")}</option>
              {cities.map((city) => (
                <option key={city.value} value={city.value}>
                  {city.value} ({num(city.count)})
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={askGeo} className="justify-start">
              <Crosshair size={18} />
              {t("filter.nearMe")}
            </Button>
            <select
              className={selectClass}
              value={draft.radius_km ?? 50}
              onChange={(event) => set("radius_km", Number(event.target.value))}
            >
              {[25, 50, 100, 200].map((km) => (
                <option key={km} value={km}>
                  {km} {t("filter.radius")}
                </option>
              ))}
            </select>
          </div>
          {geoNote ? <p className="text-xs text-muted-foreground">{geoNote}</p> : null}
          {!geoActive && !pickedCity ? (
            <p className="text-xs text-muted-foreground">{t("filter.radiusHint")}</p>
          ) : null}
          {geoFailed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!openLocationSettings()) setGeoNote(t("filter.geoOff"));
              }}
            >
              {t("filter.openSettings")}
            </Button>
          ) : null}
        </div>

        {options ? (
          <p className="text-[11px] text-muted-foreground">
            {t("filter.optionsFrom")} {num(options.listings)} {t("filter.listingsWord")}
            {draft.make ? ` · ${draft.make}` : ""}
            {draft.model ? ` ${draft.model}` : ""}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
