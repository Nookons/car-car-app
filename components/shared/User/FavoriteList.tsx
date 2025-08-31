import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserFavoriteList } from "@/features/user/getUserFavoriteList";
import {IUserFull} from "@/types/User";
import {Avatar, AvatarImage, Card, CardContent, CardTitle, Skeleton} from "@/components/ComponentsProvider";
import {BookHeart, ExternalLink, SquareMinus, Trash2} from "lucide-react";
import {useRouter} from "next/navigation";
import Link from "next/link";

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

    if (isLoading || isLoadingUser) return <Skeleton className={`w-full h-60`} />;
    if (isError) return <p>Error loading favorites</p>;

    if(!favorite_data || favorite_data.length === 0) {
        return <p>No favorites found.</p>;
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
                {favorite_data.slice(0, 3).map((fav, index) => {

                    return (
                        <Link onClick={(e) => e.stopPropagation()} href={`/${data?.language_code}/car/${fav.id}`} key={`${fav.model}-${index}`} className={`grid bg-neutral-500/5 grid-cols-[115px_1fr] gap-2 items-center p-2 rounded-lg`}>
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
                            {/*<div className={`flex justify-end`}>
                                <SquareMinus />
                            </div>*/}
                        </Link>
                    )
                })}
            </CardContent>
        </Card>
    );
};


export default FavoriteList;
