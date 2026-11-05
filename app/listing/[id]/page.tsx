"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowSquareOut,
  Buildings,
  CalendarBlank,
  CarProfile,
  Clock,
  Engine,
  GasPump,
  Gauge,
  GearSix,
  Heart,
  IdentificationCard,
  Lightning,
  MapPin,
  Palette,
  Tag,
  TrendDown,
  TrendUp,
  User,
} from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { PhotoGallery } from "@/components/photo-gallery";
import { PriceMarket } from "@/components/price-market";
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
  const [expanded, setExpanded] = React.useState(false);

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

  const specs: Array<{ icon: React.ReactNode; label: string; value: string | number }> = [
    { icon: <CalendarBlank size={18} />, label: "Год", value: item.year ?? "" },
    {
      icon: <Gauge size={18} />,
      label: "Пробег",
      value: item.mileage_km ? `${num(item.mileage_km)} км` : "",
    },
    { icon: <GasPump size={18} />, label: "Топливо", value: fuelLabel(item.fuel) },
    { icon: <GearSix size={18} />, label: "КПП", value: gearboxLabel(item.gearbox) },
    {
      icon: <Engine size={18} />,
      label: "Объём",
      value: item.engine_cm3 ? `${num(item.engine_cm3)} см³` : "",
    },
    {
      icon: <Lightning size={18} />,
      label: "Мощность",
      value: item.power_hp ? `${item.power_hp} л.с.` : "",
    },
    { icon: <CarProfile size={18} />, label: "Кузов", value: item.body ?? "" },
    { icon: <Palette size={18} />, label: "Цвет", value: item.color ?? "" },
    { icon: <IdentificationCard size={18} />, label: "VIN", value: item.vin ?? "" },
    {
      icon: <MapPin size={18} />,
      label: "Город",
      value: [item.city, item.region].filter(Boolean).join(", "),
    },
    { icon: <Clock size={18} />, label: "Добавлено", value: item.created_at ? date(item.created_at) : "" },
  ].filter((row) => row.value) as Array<{ icon: React.ReactNode; label: string; value: string | number }>;

  const mapQuery = item.lat != null && item.lon != null
    ? `${item.lat},${item.lon}`
    : `${[item.city, item.region, "Poland"].filter(Boolean).join(", ")}`;
  const mapEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=14&hl=ru&output=embed`;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

  const isFav = favorites.has(item.id);
  const analysis = item.price_analysis;
  const description = item.description?.trim();

  return (
    <div className="space-y-3">
      <Link href="/list" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft size={16} /> Назад
      </Link>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-3">
          <Card className="overflow-hidden">
            <PhotoGallery
              photos={item.photos.length ? item.photos : [item.thumbnail ?? ""]}
              title={item.title}
            />
            <div className="space-y-3 p-4">
              <p className="text-2xl font-semibold tracking-tight">
                {price(item.price, item.currency)}
              </p>
              <h1 className="text-base font-semibold leading-snug">{item.title}</h1>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <Badge key={chip}>{chip}</Badge>
                ))}
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin size={16} />
                {[item.city, item.region].filter(Boolean).join(", ")}
              </p>

              <div className="grid gap-2 pt-2 sm:grid-cols-2">
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

          <Card className="space-y-3 p-4">
            <h2 className="text-base font-semibold">Продавец</h2>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary">
                {item.seller.type === "dealer" ? <Buildings size={20} /> : <User size={20} />}
              </div>
              <div>
                <p className="font-medium">{item.seller.name || "Не указан"}</p>
                <p className="text-xs text-muted-foreground">
                  {item.seller.type === "dealer"
                    ? "Дилер"
                    : item.seller.type === "private"
                      ? "Частное лицо"
                      : "Тип не указан"}
                </p>
              </div>
            </div>
          </Card>

          {description ? (
            <Card className="space-y-2 p-4">
              <h2 className="text-base font-semibold">Описание</h2>
              <p className={`whitespace-pre-line text-sm leading-relaxed ${expanded ? "" : "line-clamp-6"}`}>
                {description}
              </p>
              {description.length > 400 ? (
                <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
                  {expanded ? "Свернуть" : "Показать полностью"}
                </Button>
              ) : null}
            </Card>
          ) : null}
        </div>

        <div className="min-w-0 space-y-3 lg:sticky lg:top-20">
          <PriceMarket item={item} />

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-base font-semibold">Где находится</h2>
              <a
                className="text-sm text-muted-foreground hover:text-foreground"
                href={mapLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Открыть в Google Maps ↗
              </a>
            </div>
            <iframe
              title="Карта"
              src={mapEmbed}
              className="h-56 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-base font-semibold">Характеристики</h2>
            <dl className="divide-y">
              {specs.map(({ icon, label, value }) => (
                <div key={label} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    {icon}
                    {label}
                  </dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
