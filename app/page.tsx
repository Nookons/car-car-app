'use client'
import React, {useEffect, useState} from "react";
import Script from "next/script";

export default function Home() {
  const [tg, setTg] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Telegram?.WebApp) return;

    const tg: any = window.Telegram.WebApp;
    setTg(tg);


    if (Number(tg.version) > 6) {
      tg.requestFullscreen();
    } else {
      console.log('Fullscreen is not available for this version of Telegram Web App');
    }

  }, []);

  useEffect(() => {
    console.log(tg);
  }, [tg]);

  return (
    <div className="p-2">
      <Script
          src="https://telegram.org/js/telegram-web-app.js?57"
          strategy="beforeInteractive"
      />
    </div>
  );
}
