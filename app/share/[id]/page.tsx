import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin } from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "@/components/ui/button";
import { num, price } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ListingCard } from "@/lib/types";

const API =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://api-production-5bee.up.railway.app"
    : "http://127.0.0.1:8080");

async function getListing(id: string): Promise<ListingCard | null> {
  try {
    const response = await fetch(`${API}/api/listings/${id}`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return (await response.json()) as ListingCard;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await getListing(id);
  if (!item) return { title: "CarCar" };
  const title = `${item.title} — ${price(item.price, item.currency)}`;
  const bits = [item.year, item.mileage_km ? `${num(item.mileage_km)} km` : null, item.city]
    .filter(Boolean)
    .join(" · ");
  return {
    title: `${title} | CarCar`,
    description: bits,
    openGraph: {
      title,
      description: bits,
      type: "article",
      images: [`/share/${id}/opengraph-image`],
    },
    twitter: { card: "summary_large_image", title, description: bits },
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getListing(id);
  if (!item) notFound();

  const analysis = item.price_analysis;
  const verdict =
    analysis?.verdict === "below"
      ? `−${Math.abs(analysis.diff_pct)}% vs market`
      : analysis?.verdict === "above"
        ? `+${analysis.diff_pct}% vs market`
        : analysis
          ? "Fair price"
          : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 py-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">
            CC
          </span>
          <span className="text-sm font-semibold">CarCar</span>
        </Link>
        <span className="text-xs text-muted-foreground">машины из Польши</span>
      </div>

      <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        {item.photos?.[0] || item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photos?.[0] || item.thumbnail || ""}
            alt=""
            className="aspect-[16/9] w-full object-cover"
          />
        ) : null}
        <div className="space-y-3 p-5">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin size={14} />
            {[item.city, item.region].filter(Boolean).join(", ") || "Polska"}
          </p>
          <h1 className="text-2xl font-semibold leading-tight">{item.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-3xl font-bold">{price(item.price, item.currency)}</p>
            {verdict ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  analysis?.verdict === "below"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : analysis?.verdict === "above"
                      ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
                )}
              >
                {verdict}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {[
              item.year,
              item.mileage_km ? `${num(item.mileage_km)} km` : null,
              item.fuel,
              item.gearbox,
              item.body,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={`/listing/${item.id}`} className={cn(buttonVariants(), "flex-1")}>
              Открыть в CarCar <ArrowRight size={16} />
            </Link>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
              >
                На площадке
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        CarCar — агрегатор объявлений из Польши. Цена и вердикт — оценка по рынку,
        не гарантия сделки.
      </p>
    </div>
  );
}
