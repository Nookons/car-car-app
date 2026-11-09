"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { SmartImage } from "@/components/smart-image";
import { mileageShort, price } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { photoSize } from "@/lib/photos";
import type { Listing } from "@/lib/types";

/**
 * Похожие объявления под карточкой: горизонтальная лента, чтобы не уводить
 * пользователя в отдельный экран и не терять контекст текущей машины.
 */
export function SimilarListings({ items, allHref }: { items: Listing[]; allHref: string }) {
  const { t } = useI18n();
  if (!items.length) return null;

  return (
    <section className="space-y-3 border-t pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{t("similar.title")}</h2>
        <Link
          href={allHref}
          className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
        >
          {t("similar.all")} <ArrowRight size={15} />
        </Link>
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {items.map((item) => {
          const photo = item.thumbnail || item.photos?.[0] || "";
          const facts = [item.year, mileageShort(item.mileage_km), item.city]
            .filter(Boolean)
            .join(" · ");
          return (
            <Link
              key={item.id}
              href={`/listing/${item.id}`}
              onClick={() => window.scrollTo({ top: 0, behavior: "auto" })}
              className="w-44 shrink-0 snap-start overflow-hidden rounded-xl border bg-card shadow-sm transition hover:shadow-md"
            >
              {photo ? (
                <SmartImage
                  src={photoSize(photo, 320, 240)}
                  alt={item.title}
                  className="aspect-[4/3] w-full"
                />
              ) : (
                <div className="aspect-[4/3] w-full bg-muted" aria-hidden />
              )}
              <div className="space-y-1 p-2.5">
                <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-medium leading-snug">
                  {item.title}
                </p>
                <p className="text-sm font-bold tracking-tight">
                  {price(item.price, item.currency)}
                </p>
                {facts ? (
                  <p className="truncate text-[11px] text-muted-foreground">{facts}</p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
