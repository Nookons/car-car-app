import React from 'react';
import {ICarAd} from "@/types/Car";
import {Skeleton} from "@/components/ComponentsProvider";
import Image from "next/image";

interface Props {
    data: ICarAd | undefined;
    isLoading: boolean;
}

const AdImageBlock: React.FC<Props> = ({data, isLoading}) => {

    if (isLoading) {
        return (
            <Skeleton className={`w-full h-50`}/>
        )
    }

    if (!data) return null;

    return (
        <>
            <Image
                className={`rounded`}
                width={1200}
                height={1200}
                src={data.image_url}
                alt={data.title}
            />
        </>
    );
};

export default AdImageBlock;