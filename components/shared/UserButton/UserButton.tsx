import React, {useEffect, useState} from 'react';
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ComponentsProvider";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useUserStore} from "@/store/user/userStore";

const test_user = {
    id: 662123629,
    first_name: "Dmytro",
    last_name: "Kolomiiets",
    username: "Nookon",
    language_code: "en",
    is_premium: true,
    allows_write_to_pm: true,
    photo_url: "https://t.me/i/userpic/320/3PCQ4TrjD68thmOXtw_kFcHxGQfUt5x6l-7dRYACRt8.svg"
}

const UserButton = () => {
    const params = useParams();
    const setUserToStore = useUserStore(state => state.setUserData)

    const [tg, setTg] = useState<any>(null);
    const [user, setUser] = useState<any>(null); // 👈 сюда положим юзера

    useEffect(() => {
        if (typeof window === 'undefined' || !window.Telegram?.WebApp) return;

        const tg: any = window.Telegram.WebApp;
        setTg(tg);

        // получаем данные юзера
        setUser(tg.initDataUnsafe?.user || null);

        if (Number(tg.version) > 6) {
            tg.requestFullscreen();
        } else {
            console.log('Fullscreen is not available for this version of Telegram Web App');
        }
    }, []);

    useEffect(() => {
        console.log("Telegram WebApp:", tg);
        console.log("Telegram User:", user); // 👈 тут юзер будет виден в консоли

        if (user !== null && user.id) {
            setUserToStore(user)
        } else {
            console.log("User not found, using test user data");
            console.log(test_user);
            setUserToStore(test_user); // 👈 если юзер не получен, используем тестового
        }

    }, [tg, user]);

    return (
        <div>
            <Link href={`/${params.locale}/user/662123629`}>
                <Avatar className={`size-[32px] rounded`}>
                    <AvatarImage src={test_user.photo_url} alt="@shadcn"/>
                    <AvatarFallback>CC</AvatarFallback>
                </Avatar>
            </Link>
        </div>
    );
};

export default UserButton;