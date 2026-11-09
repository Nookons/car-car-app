"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowSquareOut,
  Buildings,
  CaretLeft,
  Check,
  Copy,
  DotsThree,
  MapPin,
  ShareNetwork,
  Star,
  TrendDown,
  User,
  WarningCircle,
} from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { PhotoGallery } from "@/components/photo-gallery";
import { PriceHistory } from "@/components/price-history";
import { PriceMarket } from "@/components/price-market";
import { SimilarListings } from "@/components/similar-listings";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { driveShort, gearboxShort } from "@/lib/card-labels";
import {
  date,
  dateShort,
  engineVolume,
  listingTitle,
  liters,
  lowerFirst,
  num,
  powerLabel,
  price,
} from "@/lib/format";
import { labelFor, useI18n } from "@/lib/i18n";
import { sourceName } from "@/lib/source";
import { cn } from "@/lib/utils";
import type { Listing, ListingCard as ListingDetail } from "@/lib/types";

const controlClass =
  "grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/55";

export default function ListingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, favorites, toggleFavorite } = useAuth();
  const { t, lang } = useI18n();
  const [item, setItem] = React.useState<ListingDetail | null>(null);
  const [similar, setSimilar] = React.useState<Listing[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [allEquipment, setAllEquipment] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!params?.id) return;
    const id = params.id;
    let cancelled = false;
    // Переход по «похожему» не должен показывать старую машину под новым id.
    setItem(null);
    setSimilar([]);
    setError(null);
    setExpanded(false);
    setAllEquipment(false);
    setMenuOpen(false);
    api<ListingDetail>(`/listings/${id}`)
      .then((data) => !cancelled && setItem(data))
      .catch((err) => !cancelled && setError(err.message));
    api<{ items: Listing[] }>(`/listings/${id}/similar?limit=6`)
      .then((data) => !cancelled && setSimilar(data.items))
      .catch(() => !cancelled && setSimilar([]));
    return () => {
      cancelled = true;
    };
  }, [params?.id]);

  if (error) {
    return (
      <div className="-mt-4 flex flex-col items-center gap-4 py-20 text-center md:mt-0">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link href="/list" className={cn(buttonVariants({ variant: "outline" }))}>
          <CaretLeft size={16} /> {t("listing.back")}
        </Link>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="-mt-4 space-y-3 md:mt-0">
        <div className="-mx-4 md:mx-auto md:max-w-3xl">
          <Skeleton className="aspect-[4/3] w-full rounded-none md:rounded-3xl" />
        </div>
        <div className="mx-auto w-full max-w-3xl space-y-3 pt-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const title = listingTitle(item.title, item.year);
  const source = sourceName(item.source);
  // События приходят от свежих к старым: показываем только последнее изменение.
  const lastChange = item.events?.[0];
  const lastDrop = lastChange?.kind === "price_drop" ? lastChange : null;
  const dropAmount =
    lastDrop?.old_price != null && lastDrop?.new_price != null
      ? lastDrop.old_price - lastDrop.new_price
      : 0;
  // «Inny» — не модель: для неё ссылка ведёт на марку с кузовом.
  const genericModel =
    !item.model ||
    ["inny", "inne", "other", "unknown", "другое", "інше"].includes(item.model.toLowerCase());
  const makeQuery = item.make ? `make=${encodeURIComponent(item.make)}` : "";
  const similarHref = !item.make
    ? "/list"
    : genericModel
      ? `/list?${makeQuery}${item.body ? `&body=${encodeURIComponent(item.body)}` : ""}`
      : `/list?${makeQuery}&model=${encodeURIComponent(item.model ?? "")}`;
  const isFav = favorites.has(item.id);
  const analysis = item.price_analysis;
  const description = item.description?.trim();
  const published = item.created_at ? dateShort(item.created_at, lang) : "";
  const place = [item.city, item.region].filter(Boolean).join(", ");
  const facts = [place, published].filter(Boolean).join(" · ");

  const marketLabel = analysis
    ? analysis.verdict === "below"
      ? t("market.below")
      : analysis.verdict === "above"
        ? t("market.above")
        : t("market.fair")
    : t("market.noEstimate");
  const marketTone = analysis
    ? analysis.verdict === "below"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
      : analysis.verdict === "above"
        ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
        : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
    : "bg-secondary text-muted-foreground";

  const openLabel = source
    ? t("listing.openSource").replace("{source}", source)
    : t("listing.openOriginal");

  const keySpecs = [
    {
      label: t("spec.engine"),
      value: [labelFor(t, "fuel", item.fuel), engineVolume(item.engine_cm3, t("unit.volume"))]
        .filter(Boolean)
        .join(", "),
    },
    { label: t("spec.power"), value: powerLabel(item.power_hp, t("unit.power")) },
    { label: t("spec.gearbox"), value: gearboxShort(t, item.gearbox) },
    { label: t("spec.drive"), value: driveShort(t, item.drive) },
    { label: t("spec.body"), value: lowerFirst(labelFor(t, "body", item.body)) },
    {
      label: t("spec.mileage"),
      value: item.mileage_km ? `${num(item.mileage_km)} ${t("filter.radius")}` : "",
    },
  ].filter((row) => row.value);

  const extraSpecs = [
    { label: t("spec.year"), value: item.year ? String(item.year) : "" },
    { label: t("spec.version"), value: item.version },
    { label: t("spec.generation"), value: item.generation },
    { label: t("spec.color"), value: item.color },
    { label: t("spec.vin"), value: item.vin },
    { label: t("spec.seats"), value: item.seats != null ? String(item.seats) : "" },
    { label: t("spec.doors"), value: item.doors != null ? String(item.doors) : "" },
    { label: t("spec.condition"), value: labelFor(t, "condition", item.condition) },
    { label: t("spec.urban"), value: liters(item.consumption_urban) },
    { label: t("spec.extra"), value: liters(item.consumption_extra) },
    { label: t("spec.co2"), value: item.co2_gkm ? `${item.co2_gkm} g/km` : "" },
    { label: t("spec.added"), value: item.created_at ? date(item.created_at, lang) : "" },
  ].filter((row) => row.value);

  const mapQuery =
    item.lat != null && item.lon != null
      ? `${item.lat},${item.lon}`
      : `${[item.city, item.region, "Poland"].filter(Boolean).join(", ")}`;
  const mapEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=14&hl=${lang}&output=embed`;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

  const share = async () => {
    const url = window.location.href;
    const text = `${title} — ${price(item.price, item.currency)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        /* отменили */
      }
    }
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Safari/старые webview без Clipboard API — запасной путь
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        /* не удалось скопировать */
      }
      document.body.removeChild(textarea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const favorite = () => {
    if (!token) {
      router.push("/account");
      return;
    }
    void toggleFavorite(item.id);
  };

  return (
    <div className="-mt-4 space-y-4 md:mt-0 listing-page">
      <div className="mx-auto w-full max-w-3xl">
        <div className="relative -mx-4 md:mx-0">
          <div className="relative overflow-hidden bg-muted md:rounded-3xl">
            <PhotoGallery
              photos={item.photos.length ? item.photos : [item.thumbnail ?? ""]}
              title={title}
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 via-black/15 to-transparent" />

            <div
              className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3"
              style={{ paddingTop: "calc(0.75rem + var(--tg-safe-top, 0px))" }}
            >
              <Link href="/list" aria-label={t("listing.back")} className={controlClass}>
                <CaretLeft size={22} />
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={favorite}
                  aria-label={isFav ? t("listing.inFavorites") : t("listing.favorite")}
                  className={controlClass}
                >
                  <Star
                    size={20}
                    weight={isFav ? "fill" : "regular"}
                    className={isFav ? "text-amber-400" : ""}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => void share()}
                  aria-label={t("feed.share")}
                  className={controlClass}
                >
                  <ShareNetwork size={19} />
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((value) => !value)}
                    aria-label={t("listing.more")}
                    aria-expanded={menuOpen}
                    className={controlClass}
                  >
                    <DotsThree size={22} />
                  </button>

                  {menuOpen ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setMenuOpen(false)}
                        aria-label={t("common.close")}
                        className="fixed inset-0 z-30 cursor-default bg-transparent"
                      />
                      <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border bg-card p-1 text-foreground shadow-xl">
                        <button
                          type="button"
                          onClick={() => void copyLink()}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"
                        >
                          {copied ? <Check size={16} /> : <Copy size={16} />}
                          {copied ? t("listing.copied") : t("listing.copyLink")}
                        </button>
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setMenuOpen(false)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary"
                          >
                            <ArrowSquareOut size={16} />
                            {t("listing.openOriginal")}
                          </a>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {source ? (
              <span
                className="absolute left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur"
                style={{ top: "calc(4rem + var(--tg-safe-top, 0px))" }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#e53935]" />
                {t("card.source").replace("{source}", source)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 pb-24 pt-4 md:pb-0">
          <div className="space-y-2">
            {facts ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin size={14} className="shrink-0" />
                <span className="truncate">{facts}</span>
              </p>
            ) : null}
            <h1 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-3xl font-bold tracking-tight md:text-4xl">
                {price(item.price, item.currency)}
              </p>
              {item.price != null ? (
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", marketTone)}>
                  {marketLabel}
                </span>
              ) : null}
            </div>
            {lastDrop && dropAmount > 0 ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <TrendDown size={14} className="shrink-0" />
                <span>
                  {t("listing.priceDrop").replace(
                    "{amount}",
                    price(dropAmount, item.currency),
                  )}
                  {lastDrop.observed_at ? ` · ${dateShort(lastDrop.observed_at, lang)}` : ""}
                </span>
              </p>
            ) : null}
          </div>

          {item.status === "removed" ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              <WarningCircle size={18} className="mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t("listing.removedTitle")}</p>
                <p className="text-xs opacity-90">{t("listing.removedHint")}</p>
              </div>
            </div>
          ) : null}

          {keySpecs.length ? (
            <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-y-2.5 text-sm">
              {keySpecs.map((row) => (
                <React.Fragment key={row.label}>
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="min-w-0 font-medium">{row.value}</dd>
                </React.Fragment>
              ))}
            </dl>
          ) : null}

          <div
            className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-4 pt-3 backdrop-blur md:static md:mt-1 md:border-0 md:bg-transparent md:px-0 md:pt-0 md:backdrop-blur-none"
            style={{ paddingBottom: "calc(0.75rem + var(--tg-safe-bottom, 0px))" }}
          >
            <div className="mx-auto flex max-w-3xl gap-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1 px-3 text-[13px]"
                onClick={() => void share()}
              >
                <ShareNetwork size={18} />
                {t("feed.share")}
              </Button>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 flex-[1.7] items-center justify-center gap-2 rounded-xl bg-[#2f9fe0] px-3 text-[13px] font-medium text-white transition hover:bg-[#2a8fca] active:scale-[0.98]"
                >
                  <ArrowSquareOut size={18} />
                  {openLabel}
                </a>
              ) : (
                <Button size="lg" disabled className="flex-[1.7] px-3 text-[13px]">
                  {openLabel}
                </Button>
              )}
            </div>
          </div>

          <PriceMarket item={item} />
          <PriceHistory item={item} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
            <div className="min-w-0 space-y-3">
              {description ? (
                <section className="space-y-2 border-t pt-4">
                  <h2 className="text-base font-semibold">{t("listing.description")}</h2>
                  <p
                    className={`whitespace-pre-line text-sm leading-relaxed ${
                      expanded ? "" : "line-clamp-6"
                    }`}
                  >
                    {description}
                  </p>
                  {description.length > 400 ? (
                    <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
                      {expanded ? t("listing.collapse") : t("listing.showMore")}
                    </Button>
                  ) : null}
                </section>
              ) : null}

              {item.equipment.length > 0 ? (
                <section className="space-y-2 border-t pt-4">
                  <h2 className="text-base font-semibold">
                    {t("listing.equipment")}{" "}
                    <span className="text-sm text-muted-foreground">({item.equipment.length})</span>
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {(allEquipment ? item.equipment : item.equipment.slice(0, 24)).map((feature) => (
                      <Badge key={feature}>{feature}</Badge>
                    ))}
                  </div>
                  {item.equipment.length > 24 ? (
                    <Button variant="ghost" size="sm" onClick={() => setAllEquipment((value) => !value)}>
                      {allEquipment
                        ? t("listing.collapse")
                        : `${t("listing.showAll")} (${item.equipment.length})`}
                    </Button>
                  ) : null}
                </section>
              ) : null}

              <section className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">{t("listing.map")}</h2>
                  <a
                    className="text-sm text-muted-foreground hover:text-foreground"
                    href={mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("listing.openMap")} ↗
                  </a>
                </div>
                <div className="overflow-hidden rounded-xl bg-muted">
                  <iframe
                    title={t("listing.map")}
                    src={mapEmbed}
                    className="h-56 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              </section>
            </div>

            <div className="min-w-0 space-y-3">
              <section className="space-y-3 border-t pt-4">
                <h2 className="text-base font-semibold">{t("listing.seller")}</h2>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary">
                    {item.seller.type === "dealer" ? <Buildings size={20} /> : <User size={20} />}
                  </div>
                  <div>
                    <p className="font-medium">{item.seller.name || t("listing.noName")}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.seller.type === "dealer"
                        ? t("listing.dealer")
                        : item.seller.type === "private"
                          ? t("listing.private")
                          : t("listing.unknownType")}
                    </p>
                  </div>
                </div>
              </section>

              {extraSpecs.length ? (
                <section className="space-y-3 border-t pt-4">
                  <h2 className="text-base font-semibold">{t("listing.specs")}</h2>
                  <dl className="grid grid-cols-[112px_minmax(0,1fr)] gap-y-2.5 text-sm">
                    {extraSpecs.map((row) => (
                      <React.Fragment key={row.label}>
                        <dt className="text-muted-foreground">{row.label}</dt>
                        <dd className="min-w-0 font-medium">{row.value}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </section>
              ) : null}
            </div>
          </div>

          <SimilarListings items={similar} allHref={similarHref} />
        </div>
      </div>
    </div>
  );
}
