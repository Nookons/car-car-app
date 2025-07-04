import {IPriceResponse} from "@/types/Price";

export const getPrices = async (value: string, type: string): Promise<IPriceResponse> => {
    try {
        const modelPatch = `https://car-car-app.vercel.app/api/get-prices-by-model?model=${value}`
        const versionPatch = `https://car-car-app.vercel.app/api/get-prices-by-model?model=${value}`

        const res = await fetch( type === "model" ? modelPatch : versionPatch, { cache: 'no-store' });

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
