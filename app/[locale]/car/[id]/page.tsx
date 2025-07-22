'use client';

import React, {useEffect, useState} from 'react';
import {useTranslation} from "react-i18next";
import AdImageBlock from "@/shared/ad/AdImageBlock";
import AdTitle from "@/shared/ad/AdTitle";
import AdButtons from "@/shared/ad/AdButtons";
import MainParams from "@/shared/ad/MainParams";
import FullParams from "@/shared/ad/FullParams";
import AdMap from "@/shared/ad/AdMap";
import {useSearchParams} from "next/navigation";
import {ICarAd} from "@/types/Car";
import { useQuery } from '@tanstack/react-query';
import i18n from "@/app/i18n/i18n";

async function getCarById(id: string): Promise<ICarAd> {
    try {
        const res = await fetch(`https://car-car-app.vercel.app/api/get-car?car_id=${id}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return await res.json();
    } catch (error) {
        console.error("Fetch error:", error);
        throw new Error("Failed to load car data");
    }
}

type PageProps = {
    params: Promise<{
        id: string;
    }>;
};


const Page = ({ params }: PageProps) => {
    const resolvedParams = React.use(params);
    const carId = resolvedParams.id;

    const searchParams = useSearchParams();
    const uid = searchParams.get('uid');

    const { t } = useTranslation();

    const [ready, setReady] = useState<boolean>(false);

    const { data, isLoading, isError, error } = useQuery<ICarAd, Error>({
        queryKey: ['car', carId],
        queryFn: () => getCarById(carId),
        enabled: !!carId, // не запускать запрос без ID
        staleTime: 5 * 60 * 1000,
    });



    useEffect(() => {
        if (i18n.isInitialized) {
            setReady(true);
        } else {
            i18n.on('initialized', () => setReady(true));
        }
    }, [i18n]);

    if (!ready) {
        return (
            <div>Loading...</div>
        )
    }

    if (isError) {
        return <div>Error</div>
    }

    return (
        <div className={`grid grid-cols-1 gap-2 px-2 pb-10`}>
            <AdImageBlock isLoading={isLoading} data={data} />
            <AdTitle isLoading={isLoading} data={data} />
            <AdButtons isLoading={isLoading} data={data} />
            <MainParams isLoading={isLoading} data={data} />
            <FullParams  isLoading={isLoading} data={data} />
            <AdMap link={data?.map_link} />
        </div>
    );
};

export default Page;