import { ImageResponse } from "next/og";
import { num, price } from "@/lib/format";
import type { ListingCard } from "@/lib/types";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://api-production-5bee.up.railway.app"
    : "http://127.0.0.1:8080");

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let item: ListingCard | null = null;
  try {
    const response = await fetch(`${API}/api/listings/${id}`, { next: { revalidate: 300 } });
    if (response.ok) item = (await response.json()) as ListingCard;
  } catch {
    // ниже — запасная карточка
  }

  const title = item?.title ?? "CarCar";
  const priceLabel = item ? price(item.price, item.currency) : "";
  const facts = item
    ? [item.year, item.mileage_km ? `${num(item.mileage_km)} km` : null, item.city]
        .filter(Boolean)
        .join(" · ")
    : "машины из Польши";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0b1220 0%, #13233f 60%, #1b3a63 100%)",
          color: "#fff",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#fff",
              color: "#0b1220",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 22,
            }}
          >
            CC
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>CarCar</div>
          <div style={{ marginLeft: "auto", fontSize: 22, opacity: 0.65 }}>
            машины из Польши
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
            <div style={{ fontSize: 64, fontWeight: 800 }}>{priceLabel}</div>
            <div style={{ fontSize: 26, opacity: 0.75 }}>{facts}</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, opacity: 0.8 }}>
          <div>Оценка рынка · история цены · избранное</div>
          <div>carcar</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
