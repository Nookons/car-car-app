import {IPriceResponse} from "@/types/Price";

export const getPrices = async (model_value: string, brand_value: string): Promise<IPriceResponse> => {
    try {
        const patch = `https://car-car-app.vercel.app/api/get-prices?${model_value ? 'model' : 'brand'}=${model_value ? model_value : brand_value}`;
        const res = await fetch(patch, { cache: 'no-store' });

        if (!res.ok) {
            console.error(`Failed to fetch brands: ${res.status} ${res.statusText}`);
            throw new Error('Failed to fetch cars');
        }

        return await res.json();
    } catch (error) {
        console.error('Failed to load brands:', error);
        return {
            model: 'unknown',
            min_price: 0,
            max_price: 0
        };
    }
};
