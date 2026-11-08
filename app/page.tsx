"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { ListingRow } from "@/components/listing-row";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Listing } from "@/lib/types";

type Rec = {
  id: number;
  title: string;
  price: number | null;
  currency: string;
  city: string;
  thumbnail: string;
};

const QUICK = [
  { key: "home.cheap", href: "/list?price_max=30000" },
  { key: "home.low", href: "/list?mileage_max=100000" },
  { key: "home.auto", href: "/list?gearbox=automatic" },
  { key: "home.fresh", href: "/list?year_min=2024" },
] as const;

export default function HomePage() {
  const { token, user, ready, error } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = React.useState<Listing[]>([]);
  const [recs, setRecs] = React.useState<Rec[]>([]);
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
    if (!token) return;
    api<{ items: Rec[] }>("/recommendations?limit=8", { token })
      .then((data) => setRecs(data.items))
      .catch(() => setRecs([]));
  }, [token]);

  if (!ready) return <HomeSkeleton />;
  if (error) return <p className="py-10 text-center text-sm text-muted-foreground">{error}</p>;

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold">
          {t("home.greeting")}
          {user?.first_name ? `, ${user.first_name}` : ""} 👋
        </h1>
        <p className="text-sm text-muted-foreground">{t("home.subtitle")}</p>
      </section>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
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

      {recs.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">{t("home.forYou")}</h2>
            <Link href="/feed" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              {t("feed.forYou")} <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {recs.map((item) => (
              <Link
                key={item.id}
                href={`/listing/${item.id}`}
                className="min-w-0 overflow-hidden rounded-2xl border bg-card"
              >
                <div className="aspect-[4/3] bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="space-y-1 p-2">
                  <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
                  <p className="text-sm font-semibold">
                    {(item.price ?? 0).toLocaleString("pl-PL")} {item.currency}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{item.city}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">{t("home.new")}</h2>
          <Link href="/list" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            {t("home.all")} <ArrowRight size={16} />
          </Link>
        </div>
        {loading ? (
          <div className="-mx-4 space-y-3 md:mx-0">
            {Array.from({ length: 3 }).map((_, index) => (
              <RowSkeleton key={index} />
            ))}
          </div>
        ) : (
          <div className="-mx-4 space-y-3 md:mx-0">
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

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-2/3" />
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-28 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-56" />
        ))}
      </div>
    </div>
  );
}
