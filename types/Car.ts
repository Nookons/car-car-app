
export interface ICarAdd {
    id: number;
    title: string;
    posted_time: string; // ISO дата-время в строке
    price: number;
    url: string;
    brand: string;
    model: string;
    version: string;
    color: string;
    door_count: number;
    seats_count: number;
    production_year: string;
    generation: string;
    image_url: string;
    fuel_type: string;
    engine_capacity: string;
    engine_power: string;
    body_type: string;
    gearbox: string;
    transmission: string;
    mileage: string;
    condition: string;
    platform: string;
    map_link: string;
    city: string;
    seller_type: string;
    created_at: string; // ISO дата-время
    updated_at: string; // ISO дата-время
}
