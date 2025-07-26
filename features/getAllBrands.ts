import { IBrand } from '@/types/Brand';

export const getAllBrands = async (): Promise<IBrand[]> => {
    try {
        const res = await fetch(`https://car-car-app.vercel.appapi/get-all-brands`, { cache: 'no-store' });

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
