import { IBrand } from '@/types/Brand';

export const removeFromFavorite = async ({
                                        user_id,
                                        ad_id,
                                    }: {
    user_id: string;
    ad_id: string;
}): Promise<IBrand[]> => {
    const base_url = process.env.NEXT_PUBLIC_BASE_URL;

    const res = await fetch(`${base_url}api/user/remove-from-favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, car_id: ad_id }),
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error(`Failed to remove from favorite: ${res.status} ${res.statusText}`);
    }

    return await res.json();
};
