
export interface IUserFull {
    user_id: number;
    brand: string;
    model: string;
    min_price: number;
    max_price: number;
    min_year: string | null;
    max_year: string | null;
    lat: number;
    lng: number;
    locationstring: string;
    from_user_range: number;
    updated_at: string; // ISO timestamp
    created_at: string; // ISO timestamp
    max_mileage: number | null;
    seller_types: string[] | null; // предполагается, что это список
    platform_types: string[] | null;
    condition_types: string[] | null;
    id: string;
    first_name: string;
    last_name: string;
    username: string;
    language_code: string;
    chat_id: string;
}

export interface IUserFormTelegram {
    brands: string[];
    models: string[];
    minPrice: number;
    maxPrice: number;
    minYear: string;
    maxYear: string;
    rangeValue: number;
    maxMilage: number;
    sellerTypes: string[];
    platformTypes: string[];
    conditionTypes: string[];
}

export interface IUserStore {
    favorite: number[]
}