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
    DialogContent, DialogTitle, DialogClose,
} from "@/components/ComponentsProvider"
import Image from "next/image"
import { CarouselApi } from "@/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { X } from "lucide-react"

interface Props {
    data: ICarAdd | undefined;
    isLoading: boolean;
}

const PLACEHOLDER = "https://dtprodvehicleimages.blob.core.windows.net/assets/marketplace/no-car-img.png"

const getImageOrPlaceholder = (img?: string, size: string = "640x320") =>
    img && img !== "unknown" ? img.replace(/;s=\d+x\d+/, `;s=${size}`) : PLACEHOLDER

const AdImageBlock: React.FC<Props> = ({ data, isLoading }) => {
    const [api, setApi] = useState<CarouselApi>()
    const [current, setCurrent] = useState(0)
    const [count, setCount] = useState(0)
    const [readyData, setReadyData] = useState<string[]>([])

    // fullscreen
    const [isOpen, setIsOpen] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)

    // Инициализация api
    useEffect(() => {
        if (!api) return

        const update = () => {
            const snaps = api.scrollSnapList()
            setCount(snaps.length)
            setCurrent(api.selectedScrollSnap() + 1)
        }

        update()
        api.on("select", update)
        return () => api.destroy() // безопасное отключение
    }, [api])

    // подготовка изображений
    useEffect(() => {
        if (!data?.images || !Array.isArray(data.images)) return
        const uniqueImages = Array.from(new Set(data.images)).filter(Boolean)
        setReadyData(uniqueImages)
    }, [data])

    if (isLoading) return <Skeleton className="w-full h-[200px]" />
    if (!data) return null

    return (
        <div className="relative mask-b-from-50%">
            {/* Основной карусель */}
            <Carousel
                plugins={[Autoplay({ delay: 5000 })]}
                setApi={setApi}
                className="w-full"
            >
                <CarouselContent>
                    {readyData.length > 0 ? readyData.map((img, index) => (
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
                                    unoptimized
                                    className="rounded h-[280px] w-full object-cover"
                                    width={1200}
                                    height={270}
                                    src={getImageOrPlaceholder(img)}
                                    alt={data.title || "Car image"}
                                />
                            </div>
                        </CarouselItem>
                    )) : (
                        <CarouselItem>
                            <Image
                                priority
                                unoptimized
                                className="rounded h-[280px] w-full object-cover"
                                width={1200}
                                height={270}
                                src={PLACEHOLDER}
                                alt="No image"
                            />
                        </CarouselItem>
                    )}
                </CarouselContent>
            </Carousel>

            <div className="absolute text-xs bg-background/50 px-4 py-2 rounded-2xl top-2 right-2 text-center">
                {current} / {count}
            </div>

            {/* Fullscreen Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent showCloseButton={false} className="max-w-screen rounded-none w-full h-full p-0 bg-background [&>button[data-radix-dialog-close]]:hidden">
                    <VisuallyHidden>
                        <DialogTitle>Car images</DialogTitle>
                    </VisuallyHidden>

                    <DialogClose asChild>
                        <div className="flex items-center absolute bottom-5 right-5 z-50">
                            <span className={`text-neutral-500 font-bold`}>Close</span>
                            <X className="w-12 h-12 rounded-full p-2 cursor-pointer" />
                        </div>
                    </DialogClose>

                    <Carousel className="w-full h-full" opts={{ startIndex: Math.min(selectedIndex, readyData.length - 1) }}>
                        <CarouselContent>
                            {readyData.length > 0 ? readyData.map((img, index) => (
                                <CarouselItem key={index} className="flex items-center justify-center">
                                    <Image
                                        priority
                                        unoptimized
                                        className="object-contain w-full h-screen"
                                        width={1920}
                                        height={1080}
                                        src={getImageOrPlaceholder(img, "1920x1080")}
                                        alt={data.title || "Car image"}
                                    />
                                </CarouselItem>
                            )) : (
                                <CarouselItem className="flex items-center justify-center">
                                    <Image
                                        priority
                                        unoptimized
                                        className="object-contain w-full h-screen"
                                        width={1920}
                                        height={1080}
                                        src={PLACEHOLDER}
                                        alt="No image"
                                    />
                                </CarouselItem>
                            )}
                        </CarouselContent>
                        <CarouselPrevious className="text-white" />
                        <CarouselNext className="text-white" />
                    </Carousel>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default AdImageBlock
