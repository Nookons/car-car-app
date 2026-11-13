"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { BrandLogo } from "@/components/brand-logo";
import { DesktopHero } from "@/components/desktop-hero";
import { MobileHero } from "@/components/mobile-hero";
import { ListingRow } from "@/components/listing-row";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { num } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Listing } from "@/lib/types";

const QUICK = [
  { key: "home.cheap", href: "/list?price_max=30000" },
  { key: "home.low", href: "/list?mileage_max=100000" },
  { key: "home.auto", href: "/list?gearbox=automatic" },
  { key: "home.fresh", href: "/list?year_min=2024" },
  { key: "home.today", href: "/list?published_days=1" },
] as const;

type Make = { value: string; count: number };

const HOME_MAKES = 12;

export default function HomePage() {
  const { token, authed, error } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = React.useState<Listing[]>([]);
  const [recs, setRecs] = React.useState<Listing[]>([]);
  const [makes, setMakes] = React.useState<Make[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    api<{ items: Listing[] }>("/listings?limit=6&sort=new", token ? { token } : {})
      .then((data) => !cancelled && setItems(data.items))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  React.useEffect(() => {
    let cancelled = false;
    api<{ items: Make[] }>("/filters/makes")
      .then((data) => !cancelled && setMakes(data.items.slice(0, HOME_MAKES)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!authed) return;
    api<{ items: Listing[] }>("/recommendations?limit=3", { token })
      .then((data) => setRecs(data.items))
      .catch(() => setRecs([]));
  }, [token, authed]);

  return (
    <div className="space-y-8">
      <div className="-mt-4">
        <MobileHero />
        <DesktopHero />
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 min-[1152px]:mx-0 min-[1152px]:flex-wrap min-[1152px]:overflow-visible min-[1152px]:px-0">
        {QUICK.map((quick) => (
          <Link
            key={quick.href}
            href={quick.href}
            className="shrink-0 rounded-full border bg-card px-4 py-2 text-sm shadow-sm"
          >
            {t(quick.key)}
          </Link>
        ))}
      </div>

      {makes.length > 0 ? (
        <section className="mx-auto w-full max-w-2xl space-y-2 min-[1152px]:max-w-none">
          <h2 className="text-base font-semibold">{t("home.brands")}</h2>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 min-[1152px]:mx-0 min-[1152px]:grid min-[1152px]:grid-cols-12 min-[1152px]:gap-2 min-[1152px]:overflow-visible min-[1152px]:px-0">
            {makes.map((make) => (
              <Link
                key={make.value}
                href={`/list?make=${encodeURIComponent(make.value)}`}
                title={`${make.value}: ${num(make.count)}`}
                className="flex w-[78px] shrink-0 flex-col items-center gap-1 rounded-xl border bg-card px-2 py-2.5 shadow-sm transition hover:shadow-md min-[1152px]:w-auto"
              >
                <BrandLogo make={make.value} className="h-8 w-8 text-[10px]" />
                <span className="line-clamp-2 min-h-[1.9em] w-full break-words text-center text-[10px] font-medium leading-tight">
                  {make.value}
                </span>
                <span className="text-[10px] text-muted-foreground">{num(make.count)}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {recs.length > 0 ? (
        <section className="mx-auto w-full max-w-2xl space-y-3 min-[1152px]:max-w-none">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">{t("home.forYou")}</h2>
            <Link href="/feed" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              {t("feed.forYou")} <ArrowRight size={16} />
            </Link>
          </div>
          <div className="-mx-4 space-y-3 md:mx-0 min-[1152px]:grid min-[1152px]:grid-cols-2 min-[1152px]:gap-4 min-[1152px]:space-y-0">
            {recs.map((item, index) => (
              <ListingRow key={item.id} item={item} priority={index < 2} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-2xl space-y-3 min-[1152px]:max-w-none">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">{t("home.new")}</h2>
          <Link href="/list" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            {t("home.all")} <ArrowRight size={16} />
          </Link>
        </div>
        {loading ? (
          <div className="-mx-4 space-y-3 md:mx-0 min-[1152px]:grid min-[1152px]:grid-cols-2 min-[1152px]:gap-4 min-[1152px]:space-y-0">
            {Array.from({ length: 4 }).map((_, index) => (
              <RowSkeleton key={index} />
            ))}
          </div>
        ) : (
          <div className="-mx-4 space-y-3 md:mx-0 min-[1152px]:grid min-[1152px]:grid-cols-2 min-[1152px]:gap-4 min-[1152px]:space-y-0">
            {items.map((item, index) => (
              <ListingRow key={item.id} item={item} priority={index < 2} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="overflow-hidden border border-x-0 bg-card md:rounded-2xl md:border-x">
      <div className="space-y-2.5 p-4 pr-12">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-6 w-2/5" />
      </div>
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
