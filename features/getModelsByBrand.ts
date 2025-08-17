import {BrandWithModelList} from "@/components/shared/telegram-form/Model/ModelSelect";

export const getModelsByBrand = async (brands: string[]): Promise<BrandWithModelList[]> => {
    try {
        const base_url = process.env.NEXT_PUBLIC_BASE_URL;
        const res = await fetch(`${base_url}api/get-models-by-brand?brand=${brands.join(',')}`, { cache: 'no-store' });

        if (!res.ok) {
            console.error(`Failed to fetch brands: ${res.status} ${res.statusText}`);
            throw new Error('Failed to fetch cars');
        }

        return await res.json();
    } catch (error) {
        console.error('Failed to load brands:', error);
        return [
            {
                brand: 'unknown',
                models: []
            }
        ]
    }
};
