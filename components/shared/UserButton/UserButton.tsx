'use client';

import React, {useEffect, useState} from 'react';
import {Avatar, AvatarFallback, AvatarImage, Skeleton} from "@/components/ComponentsProvider";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {useUserStore} from "@/store/user/userStore";
import {ITelegramUser, IUserFull} from "@/types/User";
import {useQuery} from "@tanstack/react-query";
import {getUserByUID} from "@/features/getUserByUID";
import {userPhotoUpdate} from "@/features/user/userPhotoUpdate";
import {getUserFavoriteList} from "@/features/user/getUserFavoriteList";


const UserButton: React.FC = () => {
    const static_uid = useSearchParams().get('uid')
    const setUserToStore = useUserStore((state) => state.setUserData);
    const addToFavorite = useUserStore((state) => state.addToFavorite);

    const [uid, setUid] = useState<string | null>(null)

    const {data, isLoading, isError, error} = useQuery<IUserFull, Error>({
        queryKey: ['user', uid],
        queryFn: () => getUserByUID(uid || ''),
        enabled: !!uid,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (!uid) {
            setUid(static_uid)
        }
    }, [uid]);


    useEffect(() => {
        if (typeof window === 'undefined') return;

        const tg = (window as any).Telegram?.WebApp;
        if (!tg) return;

        try {
            tg.ready?.();
            const tgUser = tg.initDataUnsafe?.user as ITelegramUser | undefined;

            if (tgUser !== undefined) {
                const obj = {
                    uid: tgUser.id.toString(),
                    photo_url: tgUser.photo_url || ""
                }
                setUid(tgUser.id.toString())
                userPhotoUpdate(obj)
            }

            if (Number(tg.version) > 6) {
                tg.requestFullscreen?.();
            }
        } catch (_) {
            // ignore
        }
    }, [setUserToStore]);

    const setUserFavoriteStore = async () => {
        if (data) {
            try {
                const user_id = data?.user_id.toString() || '';
                const result = await getUserFavoriteList({user_id})

                if (result && result.data.length > 0) {
                    result.data.forEach(el => {
                        addToFavorite(Number(el.car_id))
                    })
                }
            } catch (error) {
                console.log(error);
            }
        }
    }

    useEffect(() => {
        if (data) {
            setUserToStore(data);
            setUserFavoriteStore();

        } else if (isError) {
            console.error('Error push user to store:', error);
        }
    }, [data, isLoading, isError, error, setUserToStore]);


    if (isLoading) {
        return (
            <Skeleton className={`w-[32px] h-[32px]`}/>
        )
    }

    if (!data) return null;

    return (
        <div>
            <Link href={`/${data.language_code}/user/${data.id}`} className="flex items-center gap-2">
                <Avatar className="size-[32px] rounded">
                    {data.photo_url ? (
                        <AvatarImage
                            src={data.photo_url}
                            alt={data.username ? `@${data.username}` : 'User avatar'}
                        />
                    ) : null}
                    <AvatarFallback>ER</AvatarFallback>
                </Avatar>
            </Link>
        </div>
    );
};

export default UserButton;
