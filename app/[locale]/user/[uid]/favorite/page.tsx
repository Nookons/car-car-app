'use client';
import React, {useEffect} from 'react';
import {useUserStore} from "@/store/user/userStore";
import {useQuery} from "@tanstack/react-query";
import {getUserFavoriteList} from "@/features/user/getUserFavoriteList";
import {Car, SquareMinus} from "lucide-react";
import {Avatar, AvatarImage} from "@/components/ui/avatar";
import {Button, Skeleton} from "@/components/ComponentsProvider";
import {useRouter} from "next/navigation";
import CarListAd from "@/components/shared/CarList/CarListAd";

const Page = () => {
    const user_store = useUserStore(state => state.user_data)
    const userId = user_store?.id

    const router = useRouter();

    const { data: favorite_data, isLoading, isError } = useQuery({
        queryKey: ['favorite_user', userId],
        queryFn: () => getUserFavoriteList(userId!),
        enabled: !!userId, // <-- только если есть реальный userId
    });

    useEffect(() => {
        console.log(favorite_data);
    }, [favorite_data]);

    if (isLoading) return <Skeleton className={`w-full h-20`} />
    if (isError) return <p>Error loading favorites</p>;

    if(!favorite_data || favorite_data.length === 0) {
        return <p>No favorites found.</p>;
    }

    return (
        <div className={`p-4`}>
            <div className={`flex flex-col gap-2 flex-wrap`}>
                {favorite_data.map((fav, index) => {

                    return (
                        <CarListAd carAd={fav} key={`${fav.model}-${index}`} />
                    )
                })}
            </div>
        </div>
    );
};

export default Page;