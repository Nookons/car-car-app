
export const getUserFavoriteListId = async (user_id: string): Promise<number[]> => {
    const base_url = process.env.NEXT_PUBLIC_BASE_URL;

    const res = await fetch(`${base_url}api/user/get-user-favorite-list-id?uid=${user_id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error(`Failed to get user favorite list: ${res.status} ${res.statusText}`);
    }

    return await res.json();
};
