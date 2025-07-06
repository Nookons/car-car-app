import {IYearResponse} from "@/types/Year";

export const getYears = async (brand_value: string, model_value: string): Promise<IYearResponse> => {
    try {
        const patch = `/api/get-years?${model_value ? 'model' : 'brand'}=${model_value ? model_value : brand_value}`;
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
            min_year: '',
            max_year: ''
        };
    }
};
