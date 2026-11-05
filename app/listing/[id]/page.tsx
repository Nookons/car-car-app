"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Heart, ArrowSquareOut } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { PhotoGallery } from "@/components/photo-gallery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { date, fuelLabel, gearboxLabel, num, price } from "@/lib/format";
import type { ListingCard as ListingDetail } from "@/lib/types";

export default function ListingPage() {
  const params = useParams<{ id: string }>();
  const { token, favorites, toggleFavorite } = useAuth();
  const [item, setItem] = React.useState<ListingDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!params?.id) return;
    let cancelled = false;
    api<ListingDetail>(`/listings/${params.id}`)
      .then((data) => !cancelled && setItem(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [params?.id]);

  if (error) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link href="/list">
          <Button variant="outline">
            <ArrowLeft size={16} /> К списку
          </Button>
        </Link>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  const chips = [
    item.year,
    item.mileage_km ? `${num(item.mileage_km)} км` : null,
    fuelLabel(item.fuel),
    gearboxLabel(item.gearbox),
  ].filter(Boolean) as string[];

  const specs: Array<[string, string | number | null]> = [
    ["Год", item.year],
    ["Пробег", item.mileage_km ? `${num(item.mileage_km)} км` : null],
    ["Топливо", fuelLabel(item.fuel)],
    ["КПП", gearboxLabel(item.gearbox)],
    ["Объём", item.engine_cm3 ? `${num(item.engine_cm3)} см³` : null],
    ["Мощность", item.power_hp ? `${item.power_hp} л.с.` : null],
    ["Кузов", item.body],
    ["Цвет", item.color],
    ["VIN", item.vin],
    ["Город", [item.city, item.region].filter(Boolean).join(", ")],
    ["Добавлено", item.created_at ? date(item.created_at) : null],
  ].filter(([, value]) => Boolean(value)) as Array<[string, string | number]>;

  const isFav = favorites.has(item.id);

  return (
    <div className="space-y-4">
      <Link
        href="/list"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} /> Назад
      </Link>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
      <Card className="overflow-hidden">
        <PhotoGallery
          photos={item.photos.length ? item.photos : [item.thumbnail ?? ""]}
          title={item.title}
        />
        <div className="space-y-3 p-4">
          <p className="text-2xl font-semibold tracking-tight">{price(item.price, item.currency)}</p>
          <h1 className="text-base font-semibold leading-snug">{item.title}</h1>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <Badge key={chip}>{chip}</Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {[item.city, item.region].filter(Boolean).join(", ")}
          </p>
          {item.seller.name ? (
            <p className="text-sm text-muted-foreground">
              Продавец: {item.seller.name}
              {item.seller.type === "dealer" ? " · дилер" : ""}
            </p>
          ) : null}

          <div className="grid gap-2 pt-2">
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <Button className="w-full">
                <ArrowSquareOut size={18} /> Открыть на otomoto
              </Button>
            </a>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => toggleFavorite(item.id)}
              disabled={!token}
            >
              <Heart size={18} weight={isFav ? "fill" : "regular"} />
              {isFav ? "В избранном" : "В избранное"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 lg:sticky lg:top-20">
        <h2 className="mb-2 text-base font-semibold">Характеристики</h2>
        <dl className="divide-y">
          {specs.map(([key, value]) => (
            <div key={key} className="flex items-baseline justify-between gap-4 py-2 text-sm">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      </div>
    </div>
  );
}
