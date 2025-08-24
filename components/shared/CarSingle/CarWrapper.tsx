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

const CarWrapper = ({id}: {id: string}) => {
    const [tg, setTg] = useState<any>(null);

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


            <Drawer>
                <DrawerTrigger asChild>
                    <Badge variant="outline" className="w-full py-2 cursor-pointer">
                        Read Description
                    </Badge>
                </DrawerTrigger>

                <DrawerContent className="rounded-t-[10px] mt-auto h-[90vh] lg:h-[80vh] flex flex-col p-4">
                    <div className="w-full flex flex-col overflow-y-auto">
                        <div className="mx-auto w-12 h-1.5 rounded-full bg-gray-300 mb-4" aria-hidden />
                        <DrawerTitle className="font-bold text-xl mb-4 line-clamp-1">
                            {data?.title}
                        </DrawerTitle>
                        <div
                            className=""
                            dangerouslySetInnerHTML={{ __html: data?.description || "" }}
                        />
                    </div>
                </DrawerContent>
            </Drawer>


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