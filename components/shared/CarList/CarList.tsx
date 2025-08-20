'use client';
import {
    Avatar, AvatarFallback, AvatarImage,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from '@/components/ComponentsProvider';
import React, { useEffect, useState } from 'react';
import {ICarAdd} from "@/types/Car";
import dayjs from "dayjs";
import {useRouter} from "next/navigation";


const CarList = ({ uid }: { uid: string }) => {
    const router = useRouter();
    const [cars, setCars] = useState<ICarAdd[]>([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    const fetchCars = async (pageNumber: number) => {
        setLoading(true);
        const res = await fetch(
            `http://localhost:3000/api/get_cars_list_for_user?uid=${uid}&page=${pageNumber}`
        );
        const data = await res.json();
        setCars(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchCars(page);
    }, [page]);

    useEffect(() => {
        console.log(cars);
    }, [cars]);

    const handleNext = () => setPage((prev) => prev + 1);
    const handlePrev = () => setPage((prev) => (prev > 1 ? prev - 1 : 1));

    return (
        <div className="flex flex-col items-center gap-4">
            {loading && <p>Loading...</p>}

            {!loading && cars.length === 0 && <p>No cars found</p>}

            {!loading &&
                cars.map((car) => (
                    <Card onClick={() => router.push(`/en/car/${car.id}?uid=${uid}`)} key={car.id} className="w-full max-w-sm">
                        <CardHeader>
                            <CardTitle>
                                <div className={`flex justify-between items-center gap-2`}>
                                    <p className={`line-clamp-1`}>{car.title}</p>
                                    <p className={`text-nowrap`}>{car.price.toLocaleString()} zl</p>
                                </div>
                            </CardTitle>
                            <CardDescription>
                                {dayjs(car.year).format("YYYY")} • {car.mileage.toLocaleString()} km
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className={`flex gap-2`}>
                                <div className="rounded-[10px] w-[135px] h-[110px] overflow-hidden">
                                    <img
                                        src={car.images[0]?.replace("s=148x110", "s=800x600")}
                                        alt={`Image of ${car.brand} ${car.model}`}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <ul className={`flex flex-col gap-1`}>
                                        <li className={`flex gap-2 items-center`}>
                                            <span className={`text-neutral-500`}>Mileage:</span>
                                            <span>{car.mileage.toLocaleString()} km</span>
                                        </li>
                                        <li className={`flex gap-2`}>
                                            <span className={`text-neutral-500`}>Engine:</span>
                                            <div className={`flex flex-col justify-start`}>
                                                <span>{car.engine_capacity}</span>
                                                <span>{car.engine_power}</span>
                                                <span>{car.fuel_type}</span>
                                            </div>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                       {/* <CardFooter>
                            <Button>View Details</Button>
                        </CardFooter>*/}
                    </Card>
                ))}

            <div className="flex gap-2 mt-4">
                <Button onClick={handlePrev} disabled={page === 1}>
                    Previous
                </Button>
                <Button onClick={handleNext} disabled={cars.length < 100}>
                    Next
                </Button>
            </div>
        </div>
    );
};

export default CarList;
