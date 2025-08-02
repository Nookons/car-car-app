
export interface ICarAdd {
    id: number;
    title: string;
    post_date: string; // ISO дата-время в строке
    price: number;
    ad_link: string;
    brand: string;
    model: string;
    version: string;
    color: string;
    door_count: number;
    seats_count: number;
    year: string;
    generation: string;
    images: string[];
    fuel_type: string;
    engine_capacity: string;
    engine_power: string;
    body_type: string;
    gearbox: string;
    transmission: string;
    mileage: number;
    new_used: string;
    platform: string;
    map_url: string;
    city: string;
    seller_type: string;
    created_at: string; // ISO дата-время
    updated_at: string; // ISO дата-время
}
