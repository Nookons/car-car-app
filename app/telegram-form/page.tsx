import React from 'react';
import TelegramForm from "@/components/shared/telegramForm";

const Page = () => {
    return (
        <div className="p-6 grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-4 gap-6">
            <TelegramForm />
        </div>
    );
};

export default Page;