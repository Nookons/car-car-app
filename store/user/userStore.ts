import { create } from 'zustand';
import {ITelegramUser, IUserFull, IUserStore} from "@/types/User";

interface State {
    data: IUserStore;
    user_data: IUserFull;
    addToFavorite: (id: number) => void;
    removeFromFavorite: (id: number) => void;
    setUserData: (data: IUserFull) => void;
}

export const useUserStore = create<State>((set) => ({
    data: {
        favorite: [],
    },

    user_data: {
        user_id: 0,
        brand: null,
        model: null,
        min_price: 0,
        max_price: 0,
        min_year: null,
        max_year: null,
        lat: 0,
        lng: 0,
        locationstring: "",
        from_user_range: 0,
        updated_at: "", // ISO timestamp
        created_at: "", // ISO timestamp
        max_mileage: 0,
        seller_types:  null, // предполагается, что это список
        platform_types:  null,
        condition_types:  null,
        id: "",
        first_name: "",
        last_name: "",
        username: "",
        language_code: "",
        chat_id: "",
        photo_url: "",
    },


    addToFavorite: (id) =>
        set((state) => ({
            data: {
                favorite: [...state.data.favorite, id]
            },
        })),

    removeFromFavorite: (id) =>
        set((state) => ({
            data: {
                favorite: state.data.favorite.filter(item => item !== id),
            },
        })),

    setUserData: (data) =>
        set((state) => ({
            user_data: {
                ...state.user_data,
                ...data,
            }
        }))
}));
