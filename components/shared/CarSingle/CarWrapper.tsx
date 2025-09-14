import React, {useEffect, useState} from 'react';
import AdImageBlock from "@/components/shared/ad/AdImageBlock";
import AdTitle from "@/components/shared/ad/AdTitle";
import AdButtons from "@/components/shared/ad/AdButtons";
import MainParams from "@/components/shared/ad/MainParams";
import {useQuery} from "@tanstack/react-query";
import {ICarAdd} from "@/types/Car";
import {getCarById} from "@/features/getCarById";
import AdDescription from "@/components/shared/ad/AdDescription";
import FullParams from "@/components/shared/ad/FullParams";
import Attribute from "@/components/shared/ad/attribute";
import AdMap from "@/components/shared/ad/AdMap";

const CarWrapper = ({id}: { id: string }) => {
    const [tg, setTg] = useState<any>(null);

    const [isFullDescription, setIsFullDescription] = useState<boolean>(false)

    const {data, isLoading, isError, error} = useQuery<ICarAdd, Error>({
        queryKey: ['car', id],
        queryFn: () => getCarById(id),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        console.log(data);
    }, [data]);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
            const tg: any = window.Telegram.WebApp;
            console.log(tg);
            setTg(tg);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.Telegram?.WebApp) return;

        const tg: any = window.Telegram.WebApp;
        setTg(tg);

        if (Number(tg.version) > 6) {
            tg.requestFullscreen();
            tg.disableVerticalSwipes()
        } else {
            console.log('Fullscreen is not available for this version of Telegram Web App');
        }
    }, [tg]);

    return (
        <div>
            <AdImageBlock
                isLoading={isLoading}
                data={data}
            />

            <AdTitle
                isLoading={isLoading}
                data={data}
            />

            <AdButtons
                isLoading={isLoading}
                data={data}
            />

            <div className={`mt-10`}>
                <MainParams
                    icon_size={2}
                    isLoading={isLoading}
                    data={data}
                />
            </div>

            <div>
                <AdDescription
                    data={data}
                />
            </div>


            <FullParams
                isLoading={isLoading}
                data={data}
            />


            <div className={`mt-10`}>
                <Attribute
                    isLoading={isLoading}
                    data={data}
                />
            </div>

            <AdMap
                link={data?.map_url}
                location_text={data?.location_text}
            />
        </div>
    );
};

export default CarWrapper;