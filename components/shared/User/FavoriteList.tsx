import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserFavoriteList } from "@/features/user/getUserFavoriteList";
import {IUserFull} from "@/types/User";
import {Avatar, AvatarImage, Card, CardContent, CardTitle} from "@/components/ComponentsProvider";
import {BookHeart, ExternalLink, SquareMinus, Trash2} from "lucide-react";
import {useRouter} from "next/navigation";

const FavoriteList = ({data, isLoadingUser}: {data: IUserFull | null | undefined, isLoadingUser: boolean}) => {
    const userId = data?.id
    const router = useRouter();

    const { data: favorite_data, isLoading, isError } = useQuery({
        queryKey: ['favorite_user', userId],
        queryFn: () => getUserFavoriteList(userId!),
        enabled: !!userId, // <-- только если есть реальный userId
    });

    const onClickCard = () => {
        router.push(`/${data?.language_code}/user/${data?.user_id}/favorite?uid=${data?.user_id}`);
    }

    if (isLoading || isLoadingUser) return <p>Loading favorites...</p>;
    if (isError) return <p>Error loading favorites</p>;

    if(!favorite_data || favorite_data.length === 0) {
        return <p>No favorites found.</p>;
    }

    return (
        <Card onClick={onClickCard}>
            <CardTitle className={`flex items-center justify-between gap-2 p-2`}>
                <div className={`flex items-center gap-2`}>
                    <BookHeart />
                    <span>Favorite cars</span>
                </div>
                <div>
                    <ExternalLink size={20} />
                </div>
            </CardTitle>
            <CardContent className={`flex flex-col gap-2 flex-wrap`}>
                {favorite_data.slice(0, 3).map((fav, index) => {

                    return (
                        <div key={`${fav.model}-${index}`} className={`grid grid-cols-[115px_1fr_35px] gap-2 items-center p-2 rounded-lg`}>
                            <div className="w-25 h-15">
                                <Avatar className="w-full h-full rounded">
                                    <AvatarImage
                                        src={fav.images[1]}
                                        className="w-full h-full object-cover"
                                    />
                                </Avatar>
                            </div>
                            <div>
                                <p className={`line-clamp-1`}>{fav.title}</p>
                                <p className={`font-semibold `}>{fav.price.toLocaleString()} zl</p>
                            </div>
                            <div className={`flex justify-end`}>
                                <SquareMinus />
                            </div>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    );
};


export default FavoriteList;
