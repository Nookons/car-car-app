'use client'
import React, {useEffect, useState} from "react";
import Script from "next/script";

export default function Page() {
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
    }, [tg, user]);

    return (
        <div className="p-2">
            {user ? (
                <div>
                    <p><b>ID:</b> {user.id}</p>
                    <p><b>Username:</b> @{user.username}</p>
                    <p><b>Name:</b> {user.first_name} {user.last_name}</p>
                    <p><b>Language:</b> {user.language_code}</p>
                </div>
            ) : (
                <p>No user data</p>
            )}
            <Script
                src="https://telegram.org/js/telegram-web-app.js?57"
                strategy="beforeInteractive"
            />
        </div>
    );
}
