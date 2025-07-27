import { create } from 'zustand';
import { IUserFormTelegram } from "@/types/User";

interface State {
    data: IUserFormTelegram;
    setBrands: (brandsStr: string[]) => void;
    setModels: (modelsStr: string[]) => void;
    filterModels: (modelsStr: string[]) => void;
    setMinPrice: (minPrice: number) => void;
    setMaxPrice: (minPrice: number) => void;
    setMinYear: (minYear: string) => void;
    setMaxYear: (maxYear: string) => void;
    setRangeValue: (rangeValue: number[]) => void;
    setMaxMilage: (maxMilage: number) => void;
    setSellerTypes: (sellerTypes: string[]) => void;
    setPlatformTypes: (platformTypes: string[]) => void;
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
        rangeValue: 50,
        maxMilage: 100000,
        sellerTypes: ["private"],
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

    setModels: (modelsStr) =>
        set((state) => ({
            data: {
                ...state.data,
                models: modelsStr,
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
            if (rangeValue[0] > 250 || rangeValue[0] < 0) return state;
            return {
                data: {
                    ...state.data,
                    rangeValue: rangeValue[0],
                },
            };
        }),

    setMaxMilage: (maxMilage) =>
        set((state) => {
            if (maxMilage > 1000000 || maxMilage < 0) return state;

            return {
                data: {
                    ...state.data,
                    maxMilage
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

    setPlatformTypes: (platformTypes) =>
        set((state) => ({
            data: {
                ...state.data,
                platformTypes
            },
        })),

    setConditionTypes: (conditionTypes) =>
        set((state) => ({
            data: {
                ...state.data,
                conditionTypes
            },
        })),

}));
