export type Listing = {
  id: number;
  external_id: string;
  source: string | null;
  title: string;
  price: number | null;
  currency: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage_km: number | null;
  fuel: string | null;
  gearbox: string | null;
  body: string | null;
  power_hp: number | null;
  engine_cm3: number | null;
  city: string | null;
  region: string | null;
  thumbnail: string | null;
  photos_count: number;
  published_at: string | null;
  distance_km: number | null;
};

export type ListingCard = Listing & {
  url: string;
  photos: string[];
  seller: { type: string | null; name: string };
  color: string;
  vin: string;
  lat: number | null;
  lon: number | null;
  created_at: string | null;
  description: string;
  version: string;
  generation: string;
  doors: number | null;
  seats: number | null;
  drive: "front" | "rear" | "awd" | null;
  condition: "new" | "used" | null;
  co2_gkm: number | null;
  consumption_urban: number | null;
  consumption_extra: number | null;
  equipment: string[];
  price_analysis: {
    median: number;
    p10: number | null;
    p90: number | null;
    sample: number;
    diff_pct: number;
    verdict: "below" | "fair" | "above";
  } | null;
};

export type User = {
  id: number;
  tg_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  lang: string;
  notify_new: boolean;
  digest: boolean;
};

export type Subscription = {
  id: number;
  name: string;
  criteria: Filters;
  active: boolean;
  created_at: string;
};

export type Filters = {
  q?: string;
  make?: string;
  model?: string;
  price_min?: number;
  price_max?: number;
  year_min?: number;
  year_max?: number;
  mileage_max?: number;
  fuel?: string;
  gearbox?: string;
  body?: string;
  drive?: string;
  condition?: string;
  seller_type?: string;
  color?: string;
  doors?: number;
  seats?: number;
  power_min?: number;
  power_max?: number;
  engine_min?: number;
  engine_max?: number;
  lat?: number;
  lon?: number;
  radius_km?: number;
  sort?: "new" | "price_asc" | "price_desc" | "distance";
};
