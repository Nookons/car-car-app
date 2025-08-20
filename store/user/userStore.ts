import { create } from 'zustand';
import {ITelegramUser, IUserStore} from "@/types/User";

interface State {
    data: IUserStore;
    user_data: ITelegramUser;
    addToFavorite: (id: number) => void;
    removeFromFavorite: (id: number) => void;
    setUserData: (data: ITelegramUser) => void;
}

export const useUserStore = create<State>((set) => ({
    data: {
        favorite: [],
    },

    user_data: {
        id: 0,
        first_name: '',
        last_name: '',
        username: '',
        language_code: '',
        is_premium: false,
        allows_write_to_pm: false,
        photo_url: ''
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
                ...data
            }
        }))

}));
