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
    DialogContent, DialogTitle,
} from "@/components/ComponentsProvider"
import Image from "next/image"
import { CarouselApi } from "@/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"

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
        <>
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
            <div className="text-muted-foreground py-2 text-center text-sm">
                Slide {current} of {count}
            </div>

            {/* FULLSCREEN DIALOG */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTitle>
                    test
                </DialogTitle>
                <DialogContent className="max-w-full w-full h-full p-0 bg-black">
                    <Carousel
                        className="w-full h-full"
                        opts={{ startIndex: selectedIndex }}
                    >
                        <CarouselContent>
                            {ready_data.map((img, index) => (
                                <CarouselItem key={index} className="flex items-center justify-center">
                                    <Image
                                        priority
                                        className="object-contain w-full h-screen"
                                        width={1920}
                                        height={1080}
                                        src={
                                            img !== 'unknown'
                                                ? img.replace(/;s=\d+x\d+/, ";s=1920x1080")
                                                : "https://dtprodvehicleimages.blob.core.windows.net/assets/marketplace/no-car-img.png"
                                        }
                                        alt={data.title || "Car image"}
                                    />
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        <CarouselPrevious className="text-white" />
                        <CarouselNext className="text-white" />
                    </Carousel>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default AdImageBlock
