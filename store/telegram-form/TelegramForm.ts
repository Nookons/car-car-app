import { create } from 'zustand';
import { IUserFormTelegram } from "@/types/User";

interface State {
    data: IUserFormTelegram;
    setBrands: (brandsStr: string[]) => void;
    setModels: (modelsStr: string[]) => void;
    filterModels: (modelsData: string[]) => void;
    setMinPrice: (minPrice: number) => void;
    setMaxPrice: (minPrice: number) => void;
    setMinYear: (minYear: string) => void;
    setMaxYear: (maxYear: string) => void;
    setRangeValue: (rangeValue: number[]) => void;
    setMaxMileage: (maxMileage: number) => void;
    setSellerTypes: (sellerTypes: string[]) => void;
    setPlatformTypes: (types: string[]) => void;
    setConditionTypes: (conditionTypes: string[]) => void;
}

export const useTelegramFormStore = create<State>((set) => ({
    data: {
        brands: [],
        models: [],
        minPrice: 0,
        maxPrice: 0,
        minYear: '',
        maxYear: '',
        rangeValue: 100,
        maxMileage: 0,
        sellerTypes: ["firma", "dealer", "private_person"],
        platformTypes: ["oto_moto"],
        conditionTypes: ["used", "new"]
    },

    setBrands: (brandsStr) =>
        set((state) => ({
            data: {
                ...state.data,
                brands: brandsStr,
            },
        })),

    setModels: (modelsData) =>
        set((state) => ({
            data: {
                ...state.data,
                models: modelsData,
            },
        })),

    filterModels: (modelsStr) =>
        set((state) => ({
            data: {
                ...state.data,
                models: state.data.models.filter((item) => modelsStr.includes(item)),
            },
        })),

    setMinPrice: (minPrice) =>
        set((state) => ({
            data: {
                ...state.data,
                minPrice
            },
        })),

    setMaxPrice: (maxPrice) =>
        set((state) => ({
            data: {
                ...state.data,
                maxPrice
            },
        })),

    setMinYear: (minYear) =>
        set((state) => ({
            data: {
                ...state.data,
                minYear: minYear.slice(0, 4)
            },
        })),

    setMaxYear: (maxYear) =>
        set((state) => ({
            data: {
                ...state.data,
                maxYear: maxYear.slice(0, 4)
            },
        })),

    setRangeValue: (rangeValue) =>
        set((state) => {
            if (rangeValue[0] > 100 || rangeValue[0] < 10) return state;
            return {
                data: {
                    ...state.data,
                    rangeValue: rangeValue[0],
                },
            };
        }),

    setMaxMileage: (maxMileage) =>
        set((state) => {
            if (maxMileage > 1000000 || maxMileage < 0) return state;

            return {
                data: {
                    ...state.data,
                    maxMileage
                },
            };
        }),

    setSellerTypes: (sellerTypes) =>
        set((state) => ({
            data: {
                ...state.data,
                sellerTypes
            },
        })),

    setPlatformTypes: (types) => set(state => ({
        data: {
            ...state.data,
            platformTypes: types
        }
    })),

    setConditionTypes: (conditionTypes) =>
        set((state) => ({
            data: {
                ...state.data,
                conditionTypes
            },
        })),

}));
