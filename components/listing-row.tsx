"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CarProfile, Star } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { SmartImage } from "@/components/smart-image";
import { driveShort, gearboxShort } from "@/lib/card-labels";
import {
  dateShort,
  engineVolume,
  listingTitle,
  mileageShort,
  powerLabel,
  price,
} from "@/lib/format";
import { labelFor, useI18n } from "@/lib/i18n";
import { sourceName } from "@/lib/source";
import type { Listing } from "@/lib/types";

const lower = (value: string) => (value ? value[0].toLowerCase() + value.slice(1) : "");

/**
 * Объявление в ленте — крупная карточка в духе Avito/Drom:
 * заголовок и цена сверху, большое фото, ниже — характеристики, город и дата.
 */
export function ListingRow({ item, priority = false }: { item: Listing; priority?: boolean }) {
  const { favorites, toggleFavorite, token } = useAuth();
  const { t, lang } = useI18n();
  const router = useRouter();
  const favorite = favorites.has(item.id);

  const title = listingTitle(item.title, item.year);
  const subtitle = item.version?.trim() || item.generation?.trim() || "";
  const condition = labelFor(t, "condition", item.condition ?? null);

  const specs = [
    engineVolume(item.engine_cm3, t("unit.volume")),
    powerLabel(item.power_hp, t("unit.power")),
    lower(labelFor(t, "fuel", item.fuel)),
    gearboxShort(t, item.gearbox),
    driveShort(t, item.drive),
    mileageShort(item.mileage_km),
  ]
    .filter(Boolean)
    .join(", ");

  const location = [item.city, item.region].filter(Boolean).join(", ");

  const onFavorite = () => {
    if (!token) {
      router.push("/account");
      return;
    }
    void toggleFavorite(item.id);
  };

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onFavorite}
        aria-label={favorite ? t("listing.inFavorites") : t("listing.favorite")}
        className="absolute right-1.5 top-1.5 z-10 grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <Star
          size={21}
          weight={favorite ? "fill" : "regular"}
          className={favorite ? "text-rose-500" : ""}
        />
      </button>

      <Link href={`/listing/${item.id}`} className="block">
        <div className="space-y-1 px-4 pb-3 pt-3.5 pr-12">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug">{title}</h3>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <p className="text-2xl font-bold leading-none tracking-tight">
              {price(item.price, item.currency)}
            </p>
            {condition ? (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {condition}
              </span>
            ) : null}
          </div>
        </div>

        {item.thumbnail ? (
          <SmartImage
            src={item.thumbnail}
            alt={title}
            priority={priority}
            className="aspect-[16/9] w-full"
          />
        ) : (
          <span className="grid aspect-[16/9] w-full place-items-center bg-muted text-muted-foreground">
            <CarProfile size={44} weight="duotone" />
          </span>
        )}

        <div className="space-y-2 px-4 pb-3 pt-2.5">
          {item.source ? (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e53935]" />
              {t("card.source").replace("{source}", sourceName(item.source))}
            </p>
          ) : null}

          {specs ? (
            <p className="line-clamp-2 text-[13px] leading-snug text-foreground/85">{specs}</p>
          ) : null}

          <div className="flex items-end justify-between gap-3 text-xs text-muted-foreground">
            <span className="truncate">{location}</span>
            <span className="shrink-0">{dateShort(item.published_at, lang)}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
