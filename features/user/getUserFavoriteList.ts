import {IUserFavoriteResponse} from "@/types/User";

export const getUserFavoriteList = async ({user_id,}: { user_id: string }): Promise<IUserFavoriteResponse> => {
    const base_url = process.env.NEXT_PUBLIC_BASE_URL;

    const res = await fetch(`${base_url}api/user/get-user-favorite-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id }),
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error(`Failed to get user favorite list: ${res.status} ${res.statusText}`);
    }

    return await res.json();
};
