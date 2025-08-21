'use client';

import React, {useEffect, useMemo, useState} from 'react';
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ComponentsProvider";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useUserStore} from "@/store/user/userStore";
import {ITelegramUser} from "@/types/User";

const UserButton: React.FC = () => {
    const params = useParams() as { locale?: string };
    const setUserToStore = useUserStore((state) => state.setUserData);

    const [user, setUser] = useState<ITelegramUser | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const tg = (window as any).Telegram?.WebApp;
        if (!tg) return;

        try {
            tg.ready?.();
        } catch (_) {
            // ignore
        }

        const tgUser = tg.initDataUnsafe?.user as ITelegramUser | undefined;

        if (tgUser?.id) {
            setUser(tgUser);
            setUserToStore(tgUser);
        }

        if (Number(tg.version) > 6) {
            try {
                tg.requestFullscreen?.();
            } catch (_) {
                // ignore
            }
        }
    }, [setUserToStore]);

    const initials = useMemo(() => {
        const fn = user?.first_name?.[0] ?? '';
        const ln = user?.last_name?.[0] ?? '';
        const i = (fn + ln).toUpperCase();
        return i || 'U';
    }, [user]);

    // Если юзера нет (например, открыто вне Telegram), ничего не рендерим
    if (!user?.id) return null;

    const locale = params?.locale ?? 'en';
    const profileHref = `/${locale}/user/${user.id}`;

    return (
        <div>
            <Link href={profileHref}>
                <Avatar className="size-[32px] rounded">
                    {user.photo_url ? (
                        <AvatarImage
                            src={user.photo_url}
                            alt={user.username ? `@${user.username}` : 'User avatar'}
                        />
                    ) : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
            </Link>
        </div>
    );
};

export default UserButton;
