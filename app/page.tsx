"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MagnifyingGlass, Sparkle } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { ListingRow } from "@/components/listing-row";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { brandLogoUrl } from "@/lib/brands";
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

const HOME_MAKES = 8;

export default function HomePage() {
  const { token, authed, user, ready, error } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = React.useState("");
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

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const term = query.trim();
          router.push(term ? `/list?q=${encodeURIComponent(term)}` : "/list");
        }}
        className="relative"
      >
        <MagnifyingGlass
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("list.searchPlaceholder")}
          aria-label={t("list.search")}
          maxLength={80}
          enterKeyHint="search"
          autoComplete="off"
          className="pl-10 pr-12"
        />
        <button
          type="submit"
          aria-label={t("list.search")}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg bg-secondary text-muted-foreground transition hover:text-foreground"
        >
          <ArrowRight size={16} />
        </button>
      </form>

      <Link
        href="/onboarding"
        className="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 transition hover:bg-primary/10"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Sparkle size={20} weight="fill" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t("onboarding.title")}</span>
          <span className="block text-xs text-muted-foreground">{t("onboarding.subtitle")}</span>
        </span>
        <ArrowRight size={18} className="shrink-0 text-muted-foreground" />
      </Link>

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

      {makes.length > 0 ? (
        <section className="mx-auto w-full max-w-2xl space-y-2">
          <h2 className="text-base font-semibold">{t("home.brands")}</h2>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {makes.map((make) => (
              <Link
                key={make.value}
                href={`/list?make=${encodeURIComponent(make.value)}`}
                title={`${make.value}: ${num(make.count)}`}
                className="flex w-[78px] shrink-0 flex-col items-center gap-1 rounded-xl border bg-card px-2 py-2.5 shadow-sm transition hover:shadow-md"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brandLogoUrl(make.value)}
                  alt=""
                  width={32}
                  height={32}
                  loading="lazy"
                  className="h-8 w-8 object-contain"
                />
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
        <section className="mx-auto w-full max-w-2xl space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">{t("home.forYou")}</h2>
            <Link href="/feed" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              {t("feed.forYou")} <ArrowRight size={16} />
            </Link>
          </div>
          <div className="-mx-4 space-y-3 md:mx-0">
            {recs.map((item, index) => (
              <ListingRow key={item.id} item={item} priority={index < 2} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-2xl space-y-3">
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
