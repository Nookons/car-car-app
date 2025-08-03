'use client'
import React, { useEffect, useState } from 'react'
import { ICarAdd } from "@/types/Car"
import {
    Card,
    CardContent,
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
    Skeleton
} from "@/components/ComponentsProvider"
import Image from "next/image"
import { CarouselApi } from "@/components/ui/carousel"

interface Props {
    data: ICarAdd | undefined;
    isLoading: boolean;
}

const AdImageBlock: React.FC<Props> = ({ data, isLoading }) => {
    const [api, setApi] = useState<CarouselApi>()
    const [current, setCurrent] = useState(0)
    const [count, setCount] = useState(0)
    const [ready_data, setReady_data] = useState<string[]>([])

    // Обработка обновления карусели
    useEffect(() => {
        if (!api) return;

        setCount(api.scrollSnapList().length)
        setCurrent(api.selectedScrollSnap() + 1)

        api.on("select", () => {
            setCurrent(api.selectedScrollSnap() + 1)
        })
    }, [api])

    // Обработка и фильтрация изображений
    useEffect(() => {
        if (data?.images) {
            const new_data = [...new Set(data.images)]
            setReady_data(new_data)
        }
    }, [data])

    // Загрузка
    if (isLoading) {
        return (
            <Skeleton className="w-full h-[200px]" />
        )
    }

    // Пустой блок
    if (!data) return null;

    return (
        <>
            <Carousel setApi={setApi} className="w-full max-w-auto">
                <CarouselContent>
                    {ready_data.map((img, index) => (
                        <CarouselItem key={index}>
                            <Card className="relative">
                                <Image
                                    priority
                                    className="rounded w-full h-auto object-cover"
                                    width={1200}
                                    height={1200}
                                    src={
                                        img !== 'unknown'
                                            ? img.replace(/;s=\d+x\d+/, ";s=1000x1000")
                                            : "https://dtprodvehicleimages.blob.core.windows.net/assets/marketplace/no-car-img.png"
                                    }
                                    alt={data.title || "Car image"}
                                />
                            </Card>
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>
            <div className="text-muted-foreground py-2 text-center text-sm">
                Slide {current} of {count}
            </div>
        </>
    )
}

export default AdImageBlock
