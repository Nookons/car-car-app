import { IBrand } from '@/types/Brand';

export const getAllBrands = async (): Promise<IBrand[]> => {
    try {
        const base_url = process.env.NEXT_PUBLIC_BASE_URL;
        const res = await fetch(`${base_url}api/get-all-brands`, { cache: 'no-store' });

        if (!res.ok) {
            console.error(`Failed to fetch brands: ${res.status} ${res.statusText}`);
            throw new Error('Failed to fetch cars');
        }

        return await res.json();
    } catch (error) {
        console.error('Failed to load brands:', error);
        return [];
    }
};
