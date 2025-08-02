import React, {useEffect, useState} from 'react';
import {ICarAdd} from "@/types/Car";
import {
    Card,
    CardContent,
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
    Skeleton
} from "@/components/ComponentsProvider";
import Image from "next/image";

interface Props {
    data: ICarAdd | undefined;
    isLoading: boolean;
}

const AdImageBlock: React.FC<Props> = ({data, isLoading}) => {

    if (isLoading) {
        return (
            <Skeleton className={`w-full h-50`}/>
        )
    }

    if (!data) return null;

    const [ready_data, setReady_data] = useState<string[]>([])

    useEffect(() => {
        if (data.images) {
            const new_data = [...new Set(data.images)]
            setReady_data(new_data)
        }
    }, [data]);

    return (
        <>
            <Carousel
                opts={{
                    align: "start",
                }}
                orientation="vertical"
                className="w-full mb-15"
            >
                <CarouselContent className="-mt-1 h-[300px]">
                    {ready_data.map((img, index) => (
                        <CarouselItem key={index}>
                            <Card className="relative">
                                <Image
                                    priority={true}
                                    className="rounded w-full h-auto object-cover"
                                    width={1200}
                                    height={1200}
                                    src={
                                        img !== 'unknown'
                                            ? img.replace(/;s=\d+x\d+/, ";s=1000x1000")
                                            : "https://dtprodvehicleimages.blob.core.windows.net/assets/marketplace/no-car-img.png"
                                    }
                                    alt={data.title}
                                />
                            </Card>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselNext />
            </Carousel>
        </>
    );
};

export default AdImageBlock;