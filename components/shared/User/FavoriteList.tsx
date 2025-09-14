import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserFavoriteList } from "@/features/user/getUserFavoriteList";
import { IUserFull } from "@/types/User";
import { Avatar, AvatarImage, Card, CardContent, CardTitle, Skeleton } from "@/components/ComponentsProvider";
import { BookHeart, ExternalLink, HeartCrack, SquareMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { removeFromFavorite } from "@/features/user/removeFromFavorite";
import { toast } from "sonner";
import dayjs from "dayjs";
import { useUserStore } from "@/store/user/userStore";
import { ICarAdd } from "@/types/Car";

const FavoriteList = ({ data, isLoadingUser }: { data: IUserFull | null | undefined; isLoadingUser: boolean }) => {
    const userId = data?.id;
    const router = useRouter();
    const user_store = useUserStore(state => state.user_data);
    const removeFromFavoriteStore = useUserStore(state => state.removeFromFavorite);
    const queryClient = useQueryClient();

    const { data: favorite_data, isLoading, isError } = useQuery({
        queryKey: ['favorite_user', userId],
        queryFn: () => getUserFavoriteList(userId!),
        enabled: !!userId,
    });

    const onClickCard = () => {
        router.push(`/${data?.language_code}/user/${data?.user_id}/favorite?uid=${data?.user_id}`);
    };

    const onRemoveFavorite = async (e: React.MouseEvent, fav: ICarAdd) => {
        e.stopPropagation();
        e.preventDefault();

        // обновляем локальный стор для мгновенного UI
        removeFromFavoriteStore(fav.id);

        try {
            await removeFromFavorite({
                user_id: user_store.user_id.toString(),
                ad_id: fav.id.toString(),
            });

            toast.success(`${fav.title}`, {
                description: `Removed on ${dayjs().format('dddd, MMMM DD, YYYY [at] HH:mm')}`,
            });

            // обновляем данные в react-query
            if (userId) {
                queryClient.invalidateQueries({ queryKey: ['favorite_user', userId] });
            }

        } catch (error) {
            console.error(error);
            toast.error(`Failed to remove favorite: ${fav.title}`);
        }
    };

    if (isLoading || isLoadingUser) return <Skeleton className={`w-full h-60`} />;
    if (isError) return <p>Error loading favorites</p>;

    if (!favorite_data || favorite_data.length === 0) {
        return (
            <Card className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-lg">
                <HeartCrack className="w-12 h-12 text-red-400 mb-4 animate-bounce" />
                <h2 className="text-xl font-semibold mb-2">No Favorites Yet</h2>
                <p className="text-sm text-neutral-500">
                    It looks like you haven't added any items to your favorites yet.
                    Start selecting your favorite products or listings, and they'll appear here!
                </p>
            </Card>
        );
    }

    return (
        <Card onClick={onClickCard}>
            <CardTitle className={`flex items-center justify-between gap-2 pb-4`}>
                <div>
                    <BookHeart size={20} />
                </div>
                <div className={`flex items-center gap-2`}>
                    <span className={`text-xs text-neutral-500`}>Favorite ({favorite_data.length})</span>
                    <ExternalLink size={20} />
                </div>
            </CardTitle>
            <CardContent className={`flex flex-col gap-2 flex-wrap`}>
                {favorite_data.slice(0, 3).map((fav, index) => (
                    <Link
                        href={`/${data?.language_code}/car/${fav.id}`}
                        key={`${fav.model}-${index}`}
                        onClick={(e) => e.stopPropagation()}
                        className={`grid bg-neutral-500/5 grid-cols-[115px_1fr_45px] gap-2 items-center p-2 rounded-lg`}
                    >
                        <div className="w-25 h-15">
                            <Avatar className="w-full h-full rounded">
                                <AvatarImage
                                    src={fav.images[0] || "https://dtprodvehicleimages.blob.core.windows.net/assets/marketplace/no-car-img.png"}
                                    className="w-full h-full object-cover"
                                />
                            </Avatar>
                        </div>
                        <div>
                            <p className={`line-clamp-1`}>{fav.title}</p>
                            <p className={`font-semibold `}>{fav.price.toLocaleString()} zl</p>
                        </div>
                        <div
                            onClick={(e) => onRemoveFavorite(e, fav)}
                            className={`flex justify-end cursor-pointer`}
                        >
                            <SquareMinus />
                        </div>
                    </Link>
                ))}
            </CardContent>
        </Card>
    );
};

export default FavoriteList;
