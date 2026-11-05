"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { ListingCard } from "@/components/listing-card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Listing } from "@/lib/types";

const QUICK = [
  { label: "До 30 000 zł", href: "/list?price_max=30000" },
  { label: "До 100 тыс км", href: "/list?mileage_max=100000" },
  { label: "Автомат", href: "/list?gearbox=automatic" },
  { label: "Свежие", href: "/list?year_min=2024" },
];

export default function HomePage() {
  const { token, user, ready, error } = useAuth();
  const [items, setItems] = React.useState<Listing[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<{ items: Listing[] }>("/listings?limit=6&sort=new", { token })
      .then((data) => !cancelled && setItems(data.items))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!ready) return <HomeSkeleton />;
  if (error) return <p className="py-10 text-center text-sm text-muted-foreground">{error}</p>;

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold">
          Привет{user?.first_name ? `, ${user.first_name}` : ""} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          Свежие объявления из Польши — раньше, чем их увидят другие.
        </p>
      </section>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {QUICK.map((quick) => (
          <Link
            key={quick.href}
            href={quick.href}
            className="shrink-0 rounded-full border bg-card px-4 py-2 text-sm shadow-sm"
          >
            {quick.label}
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Новые объявления</h2>
          <Link href="/list" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            Все <ArrowRight size={16} />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-56" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
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
