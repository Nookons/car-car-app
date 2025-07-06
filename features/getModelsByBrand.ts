import {IModelsResponse} from "@/types/Model";

export const getModelsByBrand = async (brand: string): Promise<IModelsResponse> => {
    try {
        const res = await fetch(`/api/get-models-by-brand?brand=${brand}`, { cache: 'no-store' });

        if (!res.ok) {
            console.error(`Failed to fetch brands: ${res.status} ${res.statusText}`);
            throw new Error('Failed to fetch cars');
        }

        return await res.json();
    } catch (error) {
        console.error('Failed to load brands:', error);
        return {
            brand: 'unknown',
            models: 'unknown'
        };
    }
};
