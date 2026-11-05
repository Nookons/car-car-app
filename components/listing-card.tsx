import Link from "next/link";
import { num, price } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Listing } from "@/lib/types";

export function ListingCard({ item }: { item: Listing }) {
  const { t } = useI18n();
  const meta = [
    item.year,
    item.mileage_km ? `${num(item.mileage_km)} ${t("filter.radius")}` : null,
    item.distance_km != null ? `${Math.round(item.distance_km)} ${t("filter.radius")}` : item.city,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/listing/${item.id}`}
      className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : null}
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-2 min-h-[34px] text-[13px] leading-snug">{item.title}</p>
        <p className="font-semibold">{price(item.price, item.currency)}</p>
        <p className="text-[11px] text-muted-foreground">{meta}</p>
      </div>
    </Link>
  );
}
