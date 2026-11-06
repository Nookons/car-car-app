import type { Metadata } from "next";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api-production-5bee.up.railway.app";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  try {
    const response = await fetch(`${API_URL}/api/listings/${id}`, { next: { revalidate: 600 } });
    if (!response.ok) throw new Error("not found");
    const item = await response.json();
    const facts = [item.year, item.mileage_km ? `${item.mileage_km} км` : null, item.city]
      .filter(Boolean)
      .join(" · ");
    const title = `${item.title} — ${item.price ? `${item.price} zł` : "цена не указана"}`;
    const description = [facts, item.description?.slice(0, 140)].filter(Boolean).join(" — ");
    const image = item.thumbnail || item.photos?.[0];
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "article",
        images: image ? [{ url: image, width: 1200, height: 900 }] : [],
      },
      twitter: { card: "summary_large_image", title, description, images: image ? [image] : [] },
    };
  } catch {
    return { title: "CarCar — объявление" };
  }
}

export default function ListingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
