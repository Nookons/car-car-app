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
  created_at: string | null;
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
  lat?: number;
  lon?: number;
  radius_km?: number;
  sort?: "new" | "price_asc" | "price_desc" | "distance";
};
