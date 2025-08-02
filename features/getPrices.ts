import {IPriceResponse} from "@/types/Price";

export const getPrices = async (): Promise<IPriceResponse> => {
    try {
        const base_url = process.env.NEXT_PUBLIC_BASE_URL;
        const patch = `${base_url}api/get-prices`;
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
