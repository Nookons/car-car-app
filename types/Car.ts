
export interface ICarAdd {
    id: number;
    title: string;
    price: number;
    images: string[];
    fuel_type: string | null;
    engine_capacity: string | null;
    engine_power: string | null;
    body_type: string | null;
    gearbox: string | null;
    transmission: string | null;
    country_origin: string | null;
    mileage: number | null;
    registration: string | null;
    new_used: 'new' | 'used' | null;
    date_registration: string | null;
    registered: boolean;
    original_owner: boolean;
    no_accident: boolean;
    has_registration: boolean;
    service_record: boolean;
    financial_option: boolean;
    damaged: boolean;
    map_url: string;
    location_text: string;
    lat: number;
    lng: number;
    geom: string;
    attribute: string[];
    description: string;
    post_date: string;
    ad_link: string;
    colour_type: string | null;
    battery_type: string | null;
    number_engines: number | null;
    avg_consumption: number | null;
    battery_capacity: number | null;
    electric_power_peak: number | null;
    brake_energy_recovery: boolean;
    created_at: string;
    seller_name: string;
    seller_type: string;
    brand: string;
    model: string;
    color: string | null;
    door_count: number | null;
    nr_seats: number | null;
    year: string | null;
    platform: string | null;
    generation: string | null;
}

export interface ICarListResponse {
    items: ICarAdd[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
}
