'use client'
import React from 'react';
import AdImageBlock from "@/shared/ad/AdImageBlock";
import AdTitle from "@/shared/ad/AdTitle";
import AdButtons from "@/shared/ad/AdButtons";
import MainParams from "@/shared/ad/MainParams";
import FullParams from "@/shared/ad/FullParams";
import AdMap from "@/shared/ad/AdMap";
import {ICarAdd} from "@/types/Car";
import {useQuery} from '@tanstack/react-query';

async function getCarById(id: string): Promise<ICarAdd> {
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
    const id = resolvedParams.id;

    const {data, isLoading, isError, error} = useQuery<ICarAdd, Error>({
        queryKey: ['car', id],
        queryFn: () => getCarById( id),
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
                data={data}/>

            <AdButtons
                isLoading={isLoading}
                data={data}/>

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
                link={data?.map_link}
            />
        </div>
    );
};

export default Page;