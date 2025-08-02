'use client'
import React from 'react';
import AdImageBlock from "@/components/shared/ad/AdImageBlock";
import AdTitle from "@/components/shared/ad/AdTitle";
import AdButtons from "@/components/shared/ad/AdButtons";
import MainParams from "@/components/shared/ad/MainParams";
import FullParams from "@/components/shared/ad/FullParams";
import AdMap from "@/components/shared/ad/AdMap";
import {ICarAdd} from "@/types/Car";
import {useQuery} from '@tanstack/react-query';
import { getCarById } from '@/features/getCarById';


type PageProps = {
    params: Promise<{
        id: string;
    }>;
};

const Page = ({params}: PageProps) => {
    const resolvedParams = React.use(params);
    const id = resolvedParams.id;

    const {data, isLoading, isError, error} = useQuery<ICarAdd, Error>({
        queryKey: ['car', id],
        queryFn: () => getCarById(id),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });

    if (isError) {
        return <div>Error</div>
    }

    return (
        <div className={`grid grid-cols-1 gap-2 px-2 pb-10 max-w-[1200px] m-auto`}>
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

            <AdMap
                link={data?.map_url}
            />

            <div className={`flex justify-center pt-12`}>
                <b className={`text-neutral-500 text-x`}>© 2025, CarCar.</b>
            </div>
        </div>
    );
};

export default Page;