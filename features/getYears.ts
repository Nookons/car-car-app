import {IYearResponse} from "@/types/Year";

export const getYears = async (): Promise<IYearResponse> => {
    try {
        const patch = `https://car-car-app.vercel.app/api/get-years`;
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
