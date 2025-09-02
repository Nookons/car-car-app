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
    Skeleton,
    Dialog,
    DialogContent, DialogTitle, DialogClose, Button, DialogDescription,
} from "@/components/ComponentsProvider"
import Image from "next/image"
import { CarouselApi } from "@/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"
import {VisuallyHidden} from "@radix-ui/react-visually-hidden";
import {X} from "lucide-react";

interface Props {
    data: ICarAdd | undefined;
    isLoading: boolean;
}

const AdImageBlock: React.FC<Props> = ({ data, isLoading }) => {
    const [api, setApi] = useState<CarouselApi>()
    const [current, setCurrent] = useState(0)
    const [count, setCount] = useState(0)
    const [ready_data, setReady_data] = useState<string[]>([])

    // state для fullscreen
    const [isOpen, setIsOpen] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState<number>(0)

    useEffect(() => {
        if (!api) return;
        setCount(api.scrollSnapList().length)
        setCurrent(api.selectedScrollSnap() + 1)

        api.on("select", () => {
            setCurrent(api.selectedScrollSnap() + 1)
        })
    }, [api])

    useEffect(() => {
        if (data?.images) {
            const new_data = [...new Set(data.images)]
            setReady_data(new_data)
        }
    }, [data])

    if (isLoading) {
        return <Skeleton className="w-full h-[200px]" />
    }

    if (!data) return null;

    return (
        <div className={`relative mask-b-from-50% `}>
            <Carousel
                plugins={[Autoplay({ delay: 5000 })]}
                setApi={setApi}
                className="w-full"
            >
                <CarouselContent>
                    {ready_data.map((img, index) => (
                        <CarouselItem key={index}>
                            <div
                                onClick={() => {
                                    setSelectedIndex(index)
                                    setIsOpen(true)
                                }}
                                className="cursor-zoom-in"
                            >
                                <Image
                                    priority
                                    className="rounded h-[280px] w-full object-cover"
                                    width={1200}
                                    height={270}
                                    src={
                                        img !== 'unknown'
                                            ? img.replace(/;s=\d+x\d+/, ";s=640x320")
                                            : "https://dtprodvehicleimages.blob.core.windows.net/assets/marketplace/no-car-img.png"
                                    }
                                    alt={data.title || "Car image"}
                                />
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>
            <div className="absolute text-xs bg-background/50 px-4 py-2 rounded-2xl top-2 right-2 text-center">
                {current} / {count}
            </div>



            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-full rounded-none w-full h-full p-0 bg-background">
                    <VisuallyHidden>
                        <DialogTitle>Car images</DialogTitle>
                    </VisuallyHidden>

                    {/* Кастомная кнопка закрытия */}
                    <DialogClose asChild>
                        <div
                            className="absolute bottom-5 right-5 z-50 "
                        >
                            <X className="w-12 h-12 bg-primary/25 rounded-full p-2 cursor-pointer" />
                        </div>
                    </DialogClose>

                    <Carousel className="w-full h-full" opts={{ startIndex: selectedIndex }}>
                        <CarouselContent>
                            {ready_data.map((img, index) => (
                                <CarouselItem key={index} className="flex items-center justify-center">
                                    <Image
                                        priority
                                        className="object-contain w-full h-screen"
                                        width={1920}
                                        height={1080}
                                        src={
                                            img !== "unknown"
                                                ? img.replace(/;s=\d+x\d+/, ";s=1920x1080")
                                                : "https://dtprodvehicleimages.blob.core.windows.net/assets/marketplace/no-car-img.png"
                                        }
                                        alt={data.title || "Car image"}
                                    />
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        {/*<DialogDescription className={`absolute bottom-4 left-1/2 -translate-x-1/2`}>Slides ( {count} )</DialogDescription>*/}
                        <CarouselPrevious className="text-white" />
                        <CarouselNext className="text-white" />
                    </Carousel>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default AdImageBlock