import { create } from 'zustand';
import {IUserStore} from "@/types/User";

interface State {
    data: IUserStore;
    addToFavorite: (id: number) => void;
    removeFromFavorite: (id: number) => void;
}

export const useUserStore = create<State>((set) => ({
    data: {
        favorite: [],
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
        }))
}));
