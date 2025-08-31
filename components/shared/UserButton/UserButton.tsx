'use client';

import React, { useEffect, useCallback, useState } from 'react';
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Skeleton
} from "@/components/ComponentsProvider";

import { useUserStore } from "@/store/user/userStore";
import { ITelegramUser, IUserFull } from "@/types/User";
import { getUserByUID } from "@/features/getUserByUID";
import { userPhotoUpdate } from "@/features/user/userPhotoUpdate";
import { getUserFavoriteList } from "@/features/user/getUserFavoriteList";


const UserButton: React.FC = () => {
    const searchParams = useSearchParams();
    const setUserToStore = useUserStore((state) => state.setUserData);
    const addToFavorite = useUserStore((state) => state.addToFavorite);

    // Инициализация uid сразу из query или Telegram
    const [uid, setUid] = useState<string | null>(() => {
        const queryUid = searchParams.get('uid');
        const tgUid = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();
        return queryUid || tgUid || null;
    });

    const {
        data: userData,
        isLoading,
        isError,
        error
    } = useQuery<IUserFull, Error>({
        queryKey: ['user', uid],
        queryFn: () => getUserByUID(uid!),
        enabled: !!uid,
        staleTime: 5 * 60 * 1000
    });

    // Telegram WebApp готовность и photoUpdate
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const tg = (window as any)?.Telegram?.WebApp;
        if (!tg) return;

        try {
            tg.ready?.();

            const tgUser = tg.initDataUnsafe?.user as ITelegramUser | undefined;

            if (tgUser) {
                const obj = {
                    uid: tgUser.id.toString(),
                    photo_url: tgUser.photo_url || ""
                };
                setUid(tgUser.id.toString());
                userPhotoUpdate(obj);
            }

            if (Number(tg.version) > 6) tg.requestFullscreen?.();
        } catch {
            // игнор ошибок Telegram SDK
        }
    }, []);

    // Загрузка избранного
    const setUserFavoriteStore = useCallback(async () => {
        if (!userData) return;
        try {
            const user_id = userData.user_id.toString();
            const result = await getUserFavoriteList({ user_id });
            if (result?.data?.length) {
                result.data.forEach((el) => addToFavorite(Number(el.car_id)));
            }
        } catch (err) {
            console.error("Error loading favorites:", err);
        }
    }, [userData, addToFavorite]);

    // Сохраняем пользователя в store
    useEffect(() => {
        if (userData) {
            setUserToStore(userData);
            setUserFavoriteStore();
        } else if (isError) {
            console.error("Error pushing user to store:", error);
        }
    }, [userData, isError, error, setUserToStore, setUserFavoriteStore]);

    // --- UI ---
    if (isLoading) return <Skeleton className="w-[32px] h-[32px]" />;
    if (!userData) return null;

    return (
        <Link
            href={`/${userData.language_code}/user/${userData.id}`}
            className="flex items-center gap-2"
        >
            <Avatar className="size-[32px] rounded">
                {userData.photo_url ? (
                    <AvatarImage
                        src={userData.photo_url}
                        alt={userData.username ? `@${userData.username}` : "User avatar"}
                    />
                ) : (
                    <AvatarFallback>
                        {userData.username?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                )}
            </Avatar>
        </Link>
    );
};

export default UserButton;
