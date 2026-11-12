"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Sparkle } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { BrandBubbles } from "@/components/brand-bubbles";
import { ListingRow } from "@/components/listing-row";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { filtersToQuery, saveFilters } from "@/lib/filters";
import { labelFor, useI18n } from "@/lib/i18n";
import { num } from "@/lib/format";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";
import type { Filters, Listing, Subscription } from "@/lib/types";

const DRAFT_KEY = "carcar.onboarding";
const BODIES = ["sedan", "suv", "wagon", "hatchback", "coupe", "van"] as const;
const FUELS = ["petrol", "diesel", "hybrid", "electric", "lpg"] as const;
const GEARBOXES = ["automatic", "manual"] as const;

type Make = { value: string; count: number; users?: number };

function readDraft(): Filters {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as Filters;
  } catch {
    return {};
  }
}

function Chip({
  active,
  children,
  onClick,
  title,
  style,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={style}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

export default function OnboardingPage() {
  const { authed, token, ready } = useAuth();
  const { t } = useI18n();
  const [draft, setDraft] = React.useState<Filters>({});
  const [step, setStep] = React.useState(0);
  const [makes, setMakes] = React.useState<Make[]>([]);
  const [total, setTotal] = React.useState<number | null>(null);
  const [approx, setApprox] = React.useState(false);
  const [preview, setPreview] = React.useState<Listing[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState<Subscription | null>(null);
  const [demo, setDemo] = React.useState<Listing | null>(null);
  const [demoSent, setDemoSent] = React.useState(false);
  const [loginPrompt, setLoginPrompt] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const started = React.useRef(false);

  React.useEffect(() => {
    setDraft(readDraft());
    if (started.current) return;
    started.current = true;
    track("onboarding_start");
    api<{ items: Make[] }>("/filters/makes")
      .then((data) =>
        setMakes(
          [...data.items]
            .sort(
              (a, b) =>
                (b.users ?? 0) - (a.users ?? 0) || b.count - a.count,
            )
            .slice(0, 12),
        ),
      )
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // приватный режим — не критично
    }
  }, [draft]);

  React.useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    api<{ items: Listing[]; total: number; approx?: boolean }>(
      `/listings?${filtersToQuery(draft, 0, 3)}`,
    )
      .then((data) => {
        if (cancelled) return;
        setPreview(data.items);
        setTotal(data.total);
        setApprox(Boolean(data.approx));
      })
      .catch(() => {
        if (!cancelled) setTotal(null);
      });
    return () => {
      cancelled = true;
    };
  }, [step, draft]);

  const go = (next: number) => {
    setStep(next);
    track("onboarding_step", { meta: { step: next + 1 } });
  };

  const patch = (next: Partial<Filters>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  };

  const toggle = (
    key: "makes" | "bodies" | "fuels" | "gearboxes",
    value: string,
  ) => {
    setDraft((prev) => {
      const current = prev[key] ?? [];
      return {
        ...prev,
        [key]: current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    });
  };

  const save = async () => {
    if (!ready) return;
    if (!authed) {
      setLoginPrompt(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const bits = [
        draft.makes?.join(", "),
        draft.bodies?.map((value) => labelFor(t, "body", value)).join(", "),
        draft.price_max ? `≤ ${num(draft.price_max)} zł` : null,
      ].filter(Boolean);
      const name = bits.join(" · ") || t("onboarding.start");
      const sub = await api<Subscription>("/subscriptions", {
        method: "POST",
        token: token ?? undefined,
        body: { name, criteria: draft },
      });
      saveFilters(draft);
      track("saved_search");
      track("onboarding_done");
      setSaved(sub);
      try {
        const result = await api<{ sent: boolean; listing: Listing | null }>(
          `/subscriptions/${sub.id}/demo`,
          { method: "POST", token: token ?? undefined },
        );
        setDemo(result.listing);
        setDemoSent(result.sent);
      } catch {
        // демо не обязательно: поиск уже сохранён
      }
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "error");
    } finally {
      setSaving(false);
    }
  };

  const hasUserStats = makes.some((make) => (make.users ?? 0) > 0);

  if (saved) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4 py-4">
        <div className="space-y-2 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Check size={26} weight="bold" />
          </div>
          <h1 className="text-xl font-semibold">{t("onboarding.saved")}</h1>
          <p className="text-sm text-muted-foreground">{t("onboarding.demoTitle")}</p>
        </div>

        {demo ? (
          <div className="space-y-2">
            <ListingRow item={demo} />
            <p className="text-center text-xs text-muted-foreground">
              {demoSent ? t("onboarding.demoSent") : t("onboarding.demoNoTelegram")}
            </p>
          </div>
        ) : (
          <Card className="p-5 text-center text-sm text-muted-foreground">
            {t("onboarding.noMatch")}
          </Card>
        )}

        <div className="flex gap-2">
          <Link href={`/list?${filtersToQuery(draft)}`} className={cn(buttonVariants(), "flex-1")}>
            {t("onboarding.openList")}
          </Link>
          <Link
            href="/account"
            className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
          >
            {t("nav.account")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 py-4">
      <div className="space-y-1 text-center">
        <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkle size={20} weight="fill" />
        </div>
        <h1 className="text-xl font-semibold">{t("onboarding.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("onboarding.subtitle")}</p>
      </div>

      <div className="flex items-center justify-center gap-2">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 rounded-full transition-all",
              index === step ? "w-8 bg-primary" : "w-3 bg-border",
            )}
          />
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {t("onboarding.step").replace("{current}", String(step + 1))}
      </p>

      <Card className="space-y-4 p-5">
        {step === 0 ? (
          <>
            <h2 className="text-base font-semibold">{t("onboarding.step1")}</h2>
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">{t("filter.make")}</span>
              <span className="block text-[11px] text-muted-foreground">
                {hasUserStats
                  ? t("onboarding.bubbleHint")
                  : t("onboarding.bubbleHintListings")}
              </span>
              <BrandBubbles
                makes={makes}
                selected={draft.makes ?? []}
                onToggle={(value) => toggle("makes", value)}
                onClear={() => patch({ makes: [] })}
              />
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">{t("onboarding.budget")}</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1000}
                step={1000}
                value={draft.price_max ?? ""}
                onChange={(event) =>
                  patch({
                    price_max: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
                placeholder="50 000"
              />
            </label>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2 className="text-base font-semibold">{t("onboarding.step2")}</h2>
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">{t("filter.body")}</span>
              <div className="flex flex-wrap gap-2">
                <Chip active={!draft.bodies?.length} onClick={() => patch({ bodies: [] })}>
                  {t("onboarding.any")}
                </Chip>
                {BODIES.map((body) => (
                  <Chip
                    key={body}
                    active={Boolean(draft.bodies?.includes(body))}
                    onClick={() => toggle("bodies", body)}
                  >
                    {labelFor(t, "body", body)}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">{t("filter.fuel")}</span>
              <div className="flex flex-wrap gap-2">
                <Chip active={!draft.fuels?.length} onClick={() => patch({ fuels: [] })}>
                  {t("onboarding.any")}
                </Chip>
                {FUELS.map((fuel) => (
                  <Chip
                    key={fuel}
                    active={Boolean(draft.fuels?.includes(fuel))}
                    onClick={() => toggle("fuels", fuel)}
                  >
                    {labelFor(t, "fuel", fuel)}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">{t("filter.gearbox")}</span>
              <div className="flex flex-wrap gap-2">
                <Chip active={!draft.gearboxes?.length} onClick={() => patch({ gearboxes: [] })}>
                  {t("onboarding.any")}
                </Chip>
                {GEARBOXES.map((gearbox) => (
                  <Chip
                    key={gearbox}
                    active={Boolean(draft.gearboxes?.includes(gearbox))}
                    onClick={() => toggle("gearboxes", gearbox)}
                  >
                    {labelFor(t, "gearbox", gearbox)}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">{t("filter.yearFrom")}</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={draft.year_min ?? ""}
                  onChange={(event) =>
                    patch({
                      year_min: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                  placeholder="2015"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">{t("filter.mileage")}</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={draft.mileage_max ?? ""}
                  onChange={(event) =>
                    patch({
                      mileage_max: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                  placeholder="200 000"
                />
              </label>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="text-base font-semibold">{t("onboarding.step3")}</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                draft.makes?.join(", "),
                draft.bodies?.map((value) => labelFor(t, "body", value)).join(", "),
                draft.fuels?.map((value) => labelFor(t, "fuel", value)).join(", "),
                draft.gearboxes?.map((value) => labelFor(t, "gearbox", value)).join(", "),
                draft.price_max ? `${t("filter.priceTo")}: ${num(draft.price_max)} zł` : null,
                draft.year_min ? `${t("filter.yearFrom")} ${draft.year_min}` : null,
                draft.mileage_max ? `${t("filter.mileage")} ${num(draft.mileage_max)} km` : null,
              ]
                .filter(Boolean)
                .map((item) => (
                  <span key={String(item)} className="rounded-full bg-secondary px-2.5 py-1">
                    {item}
                  </span>
                ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {total == null
                ? t("list.loading")
                : t("onboarding.found").replace(
                    "{count}",
                    `${num(total)}${approx ? "+" : ""}`,
                  )}
            </p>
            {preview.length ? (
              <div className="space-y-2">
                {preview.slice(0, 3).map((item) => (
                  <ListingRow key={item.id} item={item} />
                ))}
                {total != null && total > preview.length ? (
                  <Link
                    href={`/list?${filtersToQuery(draft)}`}
                    className="block pt-1 text-center text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {t("onboarding.openList")} · {num(total)}
                    {approx ? "+" : ""}
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("onboarding.noMatch")}</p>
            )}
          </>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        {loginPrompt && !authed ? (
          <div className="space-y-2 rounded-xl bg-secondary p-3 text-sm">
            <p className="font-medium">{t("onboarding.loginTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("onboarding.loginHint")}</p>
            <div className="flex gap-2">
              <Link
                href={`/login?next=${encodeURIComponent("/onboarding")}`}
                className={cn(buttonVariants({ size: "sm" }), "flex-1")}
              >
                {t("onboarding.login")}
              </Link>
              <Link
                href={`/register?next=${encodeURIComponent("/onboarding")}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1")}
              >
                {t("onboarding.register")}
              </Link>
            </div>
          </div>
        ) : null}

        <div className="flex gap-2 pt-1">
          {step > 0 ? (
            <Button variant="outline" onClick={() => go(step - 1)}>
              <ArrowLeft size={16} /> {t("onboarding.back")}
            </Button>
          ) : null}
          {step < 2 ? (
            <Button className="flex-1" onClick={() => go(step + 1)}>
              {t("onboarding.next")} <ArrowRight size={16} />
            </Button>
          ) : (
            <Button className="flex-1" onClick={save} disabled={saving || !ready}>
              {saving ? t("onboarding.saving") : t("onboarding.save")}
            </Button>
          )}
        </div>
        {step === 0 ? (
          <Link
            href="/list"
            className="block text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("onboarding.skip")}
          </Link>
        ) : null}
      </Card>
    </div>
  );
}
