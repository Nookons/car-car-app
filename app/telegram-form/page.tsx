import React from 'react';
import TelegramForm from "@/components/shared/telegramForm";
import Script from "next/script";

const Page = () => {
    return (
        <div className="p-6 grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-4 gap-6">
            <TelegramForm />

            <Script
                src="https://telegram.org/js/telegram-web-app.js?57"
                strategy="beforeInteractive"
            />
        </div>
    );
};

export default Page;