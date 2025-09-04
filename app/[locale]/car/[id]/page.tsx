'use client'
import React from 'react';
import Script from "next/script";
import CarWrapper from "@/components/shared/CarSingle/CarWrapper";


type PageProps = {
    params: Promise<{
        id: string;
    }>;
};

const Page = ({params}: PageProps) => {
    const resolvedParams = React.use(params);
    const id = resolvedParams.id;

    return (
        <div className={`grid grid-cols-1 gap-2 px-2 py-4 pb-10 max-w-[800px] m-auto`}>
            <CarWrapper id={id} />
            <Script
                src="https://telegram.org/js/telegram-web-app.js?57"
                strategy="beforeInteractive"
            />
        </div>
    )
        ;
};

export default Page;