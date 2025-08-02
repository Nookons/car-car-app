import {IYearResponse} from "@/types/Year";

export const getYears = async (): Promise<IYearResponse> => {
    try {
        const base_url = process.env.NEXT_PUBLIC_BASE_URL;
        const patch = `${base_url}api/get-years`;
        const res = await fetch(patch, { cache: 'no-store' });

        if (!res.ok) {
            console.error(`Failed to fetch brands: ${res.status} ${res.statusText}`);
            throw new Error('Failed to fetch cars');
        }

        return await res.json();
    } catch (error) {
        console.error('Failed to load brands:', error);
        return {
            min_year: '',
            max_year: ''
        };
    }
};
