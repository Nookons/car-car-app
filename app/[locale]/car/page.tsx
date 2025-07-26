'use client'
import React from 'react';
import {useQuery} from "@tanstack/react-query";
import {ICarAd} from "@/types/Car";
import {
    Badge,
    Card,
    CardContent,
    CardDescription, CardFooter,
    CardHeader,
} from '@/components/ComponentsProvider';
import Image from "next/image";
import {getConditionLabel, getSellerTypeLabel} from "@/feathers/getTypesLabels";
import MainParams from "@/shared/ad/MainParams";
import Link from "next/link";

async function fetchCarData(): Promise<ICarAd[]> {
    try {
        const res = await fetch(`http://localhost:3000/api/all-cars`);
        if (!res.ok) throw new Error("Network response was not ok");
        return await res.json();
    } catch (err) {
        throw err instanceof Error ? err : new Error("Unknown error");
    }
}

const Page = () => {
    const {data, isLoading, isError, error} = useQuery<ICarAd[], Error>({
        queryKey: ['cars_data'],
        queryFn: fetchCarData,
        staleTime: 5 * 60 * 1000,
    });

    if (isLoading) return <div>Loading...</div>;
    if (isError) return <div>Error: {error.message}</div>;

    return (
        <div className="px-4">
            <h1 className="text-xl font-bold mb-4">Cars list</h1>
            <div className={`flex flex-wrap justify-center gap-4`}>
                {data?.slice(0, 20).map((car, idx) => (
                    <Card key={idx} className="w-full m-0 max-w-[600px]">
                        <Link href={`/en/car/${car.id}`}>
                            <CardHeader>
                                <CardDescription className={`grid`}>
                                    <Image
                                        className={`rounded`}
                                        width={600}
                                        height={600}
                                        src={car.image_url !== 'unknown' ? car.image_url : "https://dtprodvehicleimages.blob.core.windows.net/assets/marketplace/no-car-img.png"}
                                        alt={car.title}
                                    />
                                </CardDescription>
                            </CardHeader>

                            <CardContent>
                                <div className="flex my-2 justify-between items-center gap-4 pb-2 px-4">
                                    <div>
                                        <h2 className={`line-clamp-1`}>{car.title}</h2>
                                        <div className={`flex items-center gap-1 flex-wrap`}>
                                            <p className={`text-xs text-neutral-500`}>
                                                {getConditionLabel(car.condition)} •
                                            </p>
                                            <p className={`text-xs text-neutral-500`}>
                                                {getSellerTypeLabel(car.seller_type)} •
                                            </p>
                                            <p className={`text-xs text-neutral-500`}>
                                                {car.production_year}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant={`outline`} className={`font-bold text-lg`}>{car.price.toLocaleString()} zl</Badge>
                                </div>
                                <div className="flex pb-2 px-4 flex-col gap-6 ">
                                    <div className="grid gap-2">
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className={`flex-col px-4 pb-2`}>
                                <div className={`w-full pb-4`}>
                                    <MainParams icon_size={1.3} data={car} isLoading={false} />
                                </div>
                                <p className={`text-xs text-neutral-500 line-clamp-1`}>{car.city}</p>
                            </CardFooter>
                        </Link>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default Page;
