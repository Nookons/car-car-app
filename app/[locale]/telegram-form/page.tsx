import React from 'react';
import Script from "next/script";
import TelegramForm from "@/components/shared/telegram-form/TelegramForm";

const Page = () => {
    return (
        <div className="p-6 max-w-lg m-auto">
            <TelegramForm />

            <Script
                src="https://telegram.org/js/telegram-web-app.js?57"
                strategy="beforeInteractive"
            />
        </div>
    );
};

export default Page;