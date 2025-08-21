'use client';

import React, {useEffect, useMemo, useState} from 'react';
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ComponentsProvider";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {useUserStore} from "@/store/user/userStore";
import {ITelegramUser, IUserFull} from "@/types/User";
import {useQuery} from "@tanstack/react-query";
import {ICarAdd} from "@/types/Car";
import {getUserByUID} from "@/features/getUserByUID";
import {userPhotoUpdate} from "@/features/user/userPhotoUpdate";



const UserButton: React.FC = () => {
    const static_uid = useSearchParams().get('uid')
    const setUserToStore = useUserStore((state) => state.setUserData);

    const [user, setUser] = useState<ITelegramUser | undefined>(undefined);

    const {data, isLoading, isError, error} = useQuery<IUserFull, Error>({
        queryKey: ['user', static_uid],
        queryFn: () => getUserByUID(static_uid || ''),
        enabled: !!static_uid,
        staleTime: 5 * 60 * 1000,
    });


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
                userPhotoUpdate(obj)
            }

            if (Number(tg.version) > 6) {
                tg.requestFullscreen?.();
            }
        } catch (_) {
            // ignore
        }
    }, [setUserToStore]);

    if (!user && static_uid) {
        try {
            console.log(data);

        } catch (e) {
            console.log(e as Error)
        }
    }

    useEffect(() => {
        console.log(user);
    }, [user])


    return (
        <div>
            {/*<Link href={`profileHref`}>
                <Avatar className="size-[32px] rounded">
                    {user.photo_url ? (
                        <AvatarImage
                            src={user.photo_url}
                            alt={user.username ? `@${user.username}` : 'User avatar'}
                        />
                    ) : null}
                    <AvatarFallback>ER</AvatarFallback>
                </Avatar>
            </Link>*/}
        </div>
    );
};

export default UserButton;
