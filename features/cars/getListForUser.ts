import {ICarListResponse} from "@/types/Car";

export const getListForUser = async ({uid, pageNumber}: {uid: string, pageNumber: number}): Promise<ICarListResponse | null> => {
    try {
        const base_url = process.env.NEXT_PUBLIC_BASE_URL;
        const res = await fetch(`${base_url}/api/get_cars_list_for_user?uid=${uid}&page=${pageNumber}`, { cache: 'no-store' });

        if (!res.ok) {
            console.error(`Failed to fetch brands: ${res.status} ${res.statusText}`);
            throw new Error('Failed to fetch cars');
        }

        return await res.json();
    } catch (error) {
        console.error('Failed to load brands:', error);
        return null
    }
};
