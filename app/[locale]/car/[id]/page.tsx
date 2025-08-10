'use client'
import React, {useCallback, useEffect, useState} from 'react';
import AdImageBlock from "@/components/shared/ad/AdImageBlock";
import AdTitle from "@/components/shared/ad/AdTitle";
import AdButtons from "@/components/shared/ad/AdButtons";
import MainParams from "@/components/shared/ad/MainParams";
import FullParams from "@/components/shared/ad/FullParams";
import AdMap from "@/components/shared/ad/AdMap";
import {ICarAdd} from "@/types/Car";
import {useQuery} from '@tanstack/react-query';
import {getCarById} from '@/features/getCarById';
import ErrorTemplate from "@/components/shared/ad/ErrorTemplate";
import SellerCard from "@/components/shared/ad/SellerCard";
import {Dot, Eye} from "lucide-react";
import Attribute from "@/components/shared/ad/attribute";
import {
    Badge,
    Button,
    Drawer, DrawerClose,
    DrawerContent,
    DrawerDescription, DrawerFooter,
    DrawerHeader, DrawerTitle,
    DrawerTrigger
} from "@/components/ComponentsProvider";
import Script from "next/script";


type PageProps = {
    params: Promise<{
        id: string;
    }>;
};

const Page = ({params}: PageProps) => {
    const [tg, setTg] = useState<any>(null);
    const resolvedParams = React.use(params);
    const id = resolvedParams.id;

    const {data, isLoading, isError, error} = useQuery<ICarAdd, Error>({
        queryKey: ['car', id],
        queryFn: () => getCarById(id),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (typeof window === 'undefined' || !window.Telegram?.WebApp) return;
        const tg: any = window.Telegram.WebApp;
        setTg(tg)
    }, []);

    useEffect(() => {
        if (tg) {
            try {
                tg.requestFullscreen();
            } catch (e) {
                console.warn("requestFullscreen not supported:", e);
            }
        }
    }, [tg]);


    if (isError && error) {
        return <ErrorTemplate error={error}/>
    }

    return (
        <div className={`grid grid-cols-1 gap-2 px-2 py-4 pb-10 max-w-[1200px] m-auto`}>
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
            <Script
                src="https://telegram.org/js/telegram-web-app.js?57"
                strategy="beforeInteractive"
            />
        </div>
    )
        ;
};

export default Page;