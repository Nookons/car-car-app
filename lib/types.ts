export type PriceCriterion = {
  key: string;
  subject: string | number | null;
  market: string | number | null;
  weight: number;
  match: number | null;
  effect_pct: number | null;
  per_unit_pct: number | null;
};

export type PriceComparable = {
  id: number;
  title: string | null;
  price: number | null;
  year: number | null;
  mileage_km: number | null;
  engine_cm3: number | null;
  body: string | null;
  gearbox: string | null;
  drive: string | null;
  color: string | null;
  similarity: number;
};

export type PriceReport = {
  estimated: number;
  base_median: number;
  range: { low: number; high: number };
  confidence: "low" | "medium" | "high";
  sample: number;
  excluded: number;
  avg_similarity: number;
  adjustment_pct: number;
  method: string;
  criteria: PriceCriterion[];
  comparables: PriceComparable[];
  notes: string[];
};

export type PriceAnalysis = {
  median: number;
  p10: number | null;
  p90: number | null;
  sample: number;
  diff_pct: number;
  verdict: "below" | "fair" | "above";
  confidence?: "low" | "medium" | "high";
  method?: string;
  report?: PriceReport;
};

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
  photos?: string[];
  photos_count: number;
  published_at: string | null;
  distance_km: number | null;
  version?: string | null;
  generation?: string | null;
  drive?: string | null;
  condition?: string | null;
  color?: string | null;
  seller_type?: string | null;
  price_analysis?: PriceAnalysis | null;
  favorite_status?: string;
  favorite_note?: string | null;
};

export type PriceEvent = {
  kind: "price_drop" | "price_up" | "removed" | "restored";
  old_price: number | null;
  new_price: number | null;
  observed_at: string | null;
};

export type PricePoint = {
  price: number;
  at: string | null;
  kind:
    | "initial"
    | "price_drop"
    | "price_up"
    | "removed"
    | "restored"
    | "current"
    | "price";
};

export type ListingCard = Listing & {
  url: string;
  photos: string[];
  events: PriceEvent[];
  price_history: PricePoint[];
  initial_price: number | null;
  status: "active" | "removed";
  first_seen_at?: string | null;
  last_seen_at?: string | null;
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
  price_analysis: PriceAnalysis | null;
};

export type User = {
  id: number;
  tg_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  has_password: boolean;
  lang: string;
  notify_new: boolean;
  notify_price: boolean;
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
  mileage_min?: number;
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
  published_days?: number;
  sort?: "new" | "price_asc" | "price_desc" | "distance" | "year_desc" | "mileage_asc";
};

export type AuthProviders = {
  password: boolean;
  dev: boolean;
  telegram: { bot_username: string; widget: boolean };
  oauth: Array<{ id: string; label: string }>;
};

export type Identity = {
  provider: string;
  email: string | null;
  created_at?: string;
  last_login_at?: string;
};
