'use client';
import React, {useEffect} from 'react';
import {useUserStore} from "@/store/user/userStore";
import {useQuery} from "@tanstack/react-query";
import {getUserFavoriteList} from "@/features/user/getUserFavoriteList";
import {SquareMinus} from "lucide-react";
import {Avatar, AvatarImage} from "@/components/ui/avatar";
import {Button} from "@/components/ComponentsProvider";
import {useRouter} from "next/navigation";

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

    if (isLoading) return <p>Loading favorites...</p>;
    if (isError) return <p>Error loading favorites</p>;

    if(!favorite_data || favorite_data.length === 0) {
        return <p>No favorites found.</p>;
    }

    return (
        <div className={`p-4`}>
            <div className={`my-4`}>
                <Button onClick={router.back}>Back</Button>
            </div>
            <div className={`flex flex-col gap-2 flex-wrap`}>
                {favorite_data.map((fav, index) => {

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
            </div>
        </div>
    );
};

export default Page;