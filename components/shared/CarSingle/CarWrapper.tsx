import React, {useEffect, useState} from 'react';
import AdImageBlock from "@/components/shared/ad/AdImageBlock";
import AdTitle from "@/components/shared/ad/AdTitle";
import AdButtons from "@/components/shared/ad/AdButtons";
import MainParams from "@/components/shared/ad/MainParams";
import FullParams from "@/components/shared/ad/FullParams";
import Attribute from "@/components/shared/ad/attribute";
import {Drawer, DrawerContent, DrawerTitle, DrawerTrigger} from "@/components/ui/drawer";
import {Badge} from "@/components/ui/badge";
import AdMap from "@/components/shared/ad/AdMap";
import {useQuery} from "@tanstack/react-query";
import {ICarAdd} from "@/types/Car";
import {getCarById} from "@/features/getCarById";
import {MousePointerClick} from "lucide-react";
import {VisuallyHidden} from "@radix-ui/react-visually-hidden";
import {Button} from '@/components/ComponentsProvider';

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

            <div
                className="w-full px-2  cursor-pointer mt-12"
                onClick={() => setIsFullDescription(!isFullDescription)}
            >
                <div className="flex justify-start text-xs items-center gap-2 mb-2">
                    <MousePointerClick className="text-primary"/>
                    <p className="text-neutral-500">Click to read full</p>
                </div>
                <h4 className="font-semibold text-xl mb-2">{data?.title}</h4>
                <div
                    className={`prose overflow-hidden max-w-full ${!isFullDescription && "line-clamp-3 mask-b-from-50%" }`}
                    dangerouslySetInnerHTML={{__html: data?.description || ""}}
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
            />

            <div className={`flex justify-center pt-12`}>
                <b className={`text-neutral-500 text-x`}>© 2025, CarCar.</b>
            </div>
        </div>
    );
};

export default CarWrapper;