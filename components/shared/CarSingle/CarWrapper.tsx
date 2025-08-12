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
        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
            const tg: any = window.Telegram.WebApp;
            console.log(tg);
            setTg(tg);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.Telegram?.WebApp) return;

        if (tg) {
            console.log('TG version:', Number(tg.version), 'Platform:', tg.platform);
            console.log('Fullscreen available:', tg.viewport?.requestFullscreen?.isAvailable?.());
            const location = tg.LocationManager.getLocation();
            console.log(location);
            if (Number(tg.version) > 6.0) {
                tg.requestFullscreen();
            }
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
                <DrawerTrigger
                    className=""
                >
                    <Badge variant={'outline'} className={`w-full py-2`}>Read Description</Badge>
                </DrawerTrigger>
                <DrawerContent
                    className=" flex flex-col rounded-t-[10px] mt-24 h-[100%] lg:h-[100%] fixed bottom-0 left-0 right-0 outline-none"
                >
                    <div className="p-4 rounded-t-[10px] flex-1 overflow-y-auto">
                        <div className="max-w-md mx-auto space-y-4">
                            <div
                                aria-hidden
                                className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 mb-8"
                            />
                            <DrawerTitle className="font-bold text-xl mb-4 line-clamp-1">{data?.title}</DrawerTitle>
                            <p>{data?.description}</p>
                        </div>
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