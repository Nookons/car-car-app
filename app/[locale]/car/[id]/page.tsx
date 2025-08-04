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
import {getCarById} from '@/features/getCarById';
import ErrorTemplate from "@/components/shared/ad/ErrorTemplate";
import SellerCard from "@/components/shared/ad/SellerCard";
import {Dot} from "lucide-react";


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

    console.log(error);

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

            <div className={`grid grid-cols-2 gap-2 p-2 text-xs`}>
                {data?.attribute.map((el) => (
                    <div className={`grid grid-cols-[25px_1fr] gap-1 pr-2 rounded bg-primary/15 items-center`}>
                        <Dot size={16} className={`bg-primary rounded-l`}/>
                        <span className={`line-clamp-1`}>{el}</span>
                    </div>
                ))}
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

export default Page;