'use client';
import {useQuery} from "@tanstack/react-query";
import {ICarAdd} from "@/types/Car";
import React from "react";
import Image from "next/image";
import {CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableRow
} from "@/components/ui/table";
import {Button} from "@/components/ui/button";
import {CircleUser, HeartPlus, SquareArrowOutUpRight} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import relativeTime from 'dayjs/plugin/relativeTime'
import duration from 'dayjs/plugin/duration'
import {ModeToggle} from "@/components/ModeToggle/ModeToggle";
import {useSearchParams} from "next/navigation";
import UserButton from "@/components/shared/UserButton/UserButton";
import CarMainSkeleton from "@/Skeletons/Car/CarMainSkeleton";

dayjs.extend(relativeTime)
dayjs.extend(duration)

function getGoogleMapEmbedUrl(originalUrl: string): string | null {
    try {
        const url = new URL(originalUrl);
        let coords = url.searchParams.get('query');

        if (!coords) {
            coords = url.searchParams.get('center');
        }

        if (!coords) return null;

        return `https://www.google.com/maps?q=${coords}&z=15&output=embed`;
    } catch (e) {
        return null;
    }
}

async function getCarById(id: string): Promise<ICarAdd> {
    try {
        const res = await fetch(`http://localhost:3000/api/get-car?car_id=${id}`);
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
    const carId = resolvedParams.id;
    const searchParams = useSearchParams();
    const uid = searchParams.get('uid');

    const {data, isLoading, isError} = useQuery<ICarAdd, Error>({
        queryKey: ["car", carId],
        queryFn: () => getCarById(carId),
        staleTime: 5 * 60 * 1000,
    });

    if (isLoading) {
        return <CarMainSkeleton />;
    }

    if (isError) {
        return <div className="max-w-[1400px] m-auto px-4 text-red-600">Error loading car details. Please try again.</div>;
    }

    if (!data) {
        return <div className="max-w-[1400px] m-auto px-4">No car data found for ID: {carId}.</div>;
    }

    const {
        image_url, title, seller_type, condition, production_year, price, posted_time, url,
        mileage, fuel_type, gearbox, engine_capacity, body_type, engine_power, brand, model,
        version, color, door_count, seats_count, generation, transmission, platform, map_link
    } = data;

    const postedDate = dayjs(posted_time);
    const now = dayjs();
    const diffInHours = now.diff(postedDate, 'hour');

    const googleMapEmbedUrl = getGoogleMapEmbedUrl(map_link);

    return (
        <div className="max-w-[1400px] m-auto px-2 md:px-0">
            <div className={`py-4 flex justify-between`}>
                <ModeToggle />
                <UserButton uid={uid} />
            </div>
            <div className={`grid md:grid-cols-[1fr_400px] gap-4 md:gap-0`}>
                <div className="p-0 overflow-hidden h-78 md:h-148 rounded relative">
                    <Image
                        src={image_url || "/car-placeholder.jpg"}
                        alt={title}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover"
                        priority
                    />
                </div>
                <div className={`p-4`}>
                    <div className={`flex justify-between items-start gap-4`}>
                        <div className={`space-y-1`}>
                            <CardTitle className="text-lg font-semibold line-clamp-1">{title}</CardTitle>
                            <p className={`text-xs text-neutral-500 text-nowrap`}>
                                {seller_type}
                            </p>
                            <p className={`text-xs text-neutral-500 text-nowrap`}>
                                {condition} • {production_year}
                            </p>
                        </div>
                        <p className="text-xl">
                            <Badge variant={`outline`} className="font-medium text-nowrap">
                                <span className={`text-base font-bold`}>{price.toLocaleString()} PLN</span>
                            </Badge>
                        </p>
                    </div>
                    <div className={`flex flex-col gap-2 mt-6`}>
                        <p className={`text-xs text-neutral-500 text-nowrap`}>
                            {diffInHours < 24
                                ? postedDate.fromNow()
                                : postedDate.format('dddd, MMMM DD [at] HH:mm')}
                        </p>
                        <Link href={url} target="_blank" rel="noopener noreferrer">
                            <Button className={`w-full flex items-center justify-center gap-2`}>
                                <SquareArrowOutUpRight size={18} aria-hidden="true"/>
                                <span className={`font-bold`}>Open original</span>
                            </Button>
                        </Link>
                        <Button variant={`outline`} className={`w-full flex items-center justify-center gap-2`}>
                            <HeartPlus size={18} aria-hidden="true"/>
                            <span className={`font-bold`}>Favorite</span>
                        </Button>
                    </div>
                    <div className={`grid grid-cols-3 gap-6 mt-12 text-sm text-center`}>
                        <div className={`flex flex-col items-center gap-2`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" fill="none"
                                 viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                                <path fill="currentColor"
                                      d="M2 20.004 7.898 4h2.13L4.13 20.004H2ZM13.999 4l5.872 16.004h2.13L16.13 4h-2.131ZM11.002 8h2V6h-2v2ZM11.002 12.999h2v-3h-2v3ZM13.002 19h-2v-4h2v4Z"></path>
                            </svg>
                            <span>{Number(mileage).toLocaleString()} km</span>
                        </div>

                        <div className={`flex flex-col items-center gap-2`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" fill="none"
                                 viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                                <path fill="currentColor" d="M10.997 9H6V5h4.997v4Z"></path>
                                <path fill="currentColor" fillRule="evenodd"
                                      d="M16 3.042h3.408L22 5.579v13.422C22 20.206 21.201 22 19 22c-2.2 0-3-1.794-3-3v-6c0-.806-.55-.989-1.011-1H14v10H3V3.001l1-1h9l1 1V10h1c1.206 0 3 .799 3 3v6c.012.449.195 1 1 1 .806 0 .988-.55 1-1.011V6.421l-1.408-1.379H16l-1-1.041 1-.959ZM12 20H5V4.001h7V20Z"
                                      clipRule="evenodd"></path>
                            </svg>
                            <span>{fuel_type}</span>
                        </div>

                        <div className={`flex flex-col items-center gap-2`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" fill="none"
                                 viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                                <path fill="currentColor" fillRule="evenodd"
                                      d="M21 4a2 2 0 0 0-4 0c0 .738.405 1.376 1 1.723v4.863l-.414.414H13V5.745A1.991 1.991 0 0 0 14.042 4a2 2 0 0 0-4 0c0 .721.385 1.348.958 1.7V11H6V5.723A1.994 1.994 0 0 0 5 2a1.994 1.994 0 0 0-1 3.723v12.554c-.595.347-1 .984-1 1.723a2 2 0 0 0 4 0c0-.739-.405-1.376-1-1.723V13h5v5.3a1.99 1.99 0 0 0-.958 1.7 2 2 0 0 0 4 0A1.99 1.99 0 0 0 13 18.255V13h5.414L20 11.414V5.723c.595-.347 1-.985 1-1.723Z"
                                      clipRule="evenodd"></path>
                            </svg>
                            <span>{gearbox}</span>
                        </div>

                        <div className={`flex flex-col items-center gap-2`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" fill="none"
                                 viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                                <path fill="currentColor" fillRule="evenodd"
                                      d="M16 18H12.83l-2-2H8v-6h8v8Zm5-9-1 1v2.042h-2V9l-1-1h-4V6h2.5l1-1-1-1h-7l-1 1 1 1H11v2H7L6 9v3H4v-2L3 9l-1 1v6l1 1 1-1v-2h2v3l1 1h3l2 2h5l1-1v-5h2v2l1 1 1-1v-6l-1-1Z"
                                      clipRule="evenodd"></path>
                            </svg>
                            <span>{engine_capacity}</span>
                        </div>

                        <div className={`flex flex-col items-center gap-2`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" fill="none"
                                 viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                                <path fill="currentColor" fillRule="evenodd"
                                      d="M17 7h4c.258.194.433.387.632.608.11.121.226.25.368.392v6l-1 1h-3v-1c0-.6-.4-1-1-1s-1 .4-1 1v1H8v-1c0-.6-.4-1-1-1s-1 .4-1 1v1H3l-1-1V7l3.8-5H16l1 5Zm2.8 6h.2V9h-4.7L15 7.3 14.3 4H6.7L4 7.6V13h.2c.4-1.2 1.5-2 2.8-2 1.3 0 2.4.8 2.8 2h4.4c.4-1.2 1.5-2 2.8-2 1.3 0 2.4.8 2.8 2ZM7 16c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.4-3-3-3Zm0 4c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.5 1-1 1Zm10-4c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.4-3-3-3Zm0 4c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.5 1-1 1Z"
                                      clipRule="evenodd"></path>
                            </svg>
                            <span>{body_type}</span>
                        </div>

                        <div className={`flex flex-col items-center gap-2`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" fill="none"
                                 viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                                <g clipPath="url(#millage_svg__a)">
                                    <path fill="currentColor" fillRule="evenodd"
                                          d="M12 13c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1c0-.5-.4-1-1-1Zm5-4v1.4l-1.3 1.3-1 1c.2.4.3.8.3 1.3 0 1.7-1.3 3-3 3s-3-1.3-3-3 1.3-3 3-3c.5 0 .9.1 1.3.3l1-1L15.6 9H17Zm-5-3c-4.4 0-8 3.6-8 8 0 2.3.4 3.8 1.4 5h13.1c1-1.2 1.4-2.7 1.4-5 .1-4.4-3.5-8-7.9-8Zm0-2c5.5 0 10 4.5 10 10 0 2.2-.3 4.7-2.3 6.7l-.7.3H5l-.7-.3c-2-2-2.3-4.5-2.3-6.7C2 8.5 6.5 4 12 4Z"
                                          clipRule="evenodd"></path>
                                </g>
                                <defs>
                                    <clipPath id="millage_svg__a">
                                        <path fill="#fff" d="M2 4h20v17H2z"></path>
                                    </clipPath>
                                </defs>
                            </svg>
                            <span>{engine_power}</span>
                        </div>
                    </div>

                    <Table className={`mt-8`}>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-medium">Brand</TableCell>
                                <TableCell className="text-right">{brand}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Model</TableCell>
                                <TableCell className="text-right">{model}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Version</TableCell>
                                <TableCell className="text-right">{version}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Color</TableCell>
                                <TableCell className="text-right">{color}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Door count</TableCell>
                                <TableCell className="text-right">{door_count}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Seats count</TableCell>
                                <TableCell className="text-right">{seats_count}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Production year</TableCell>
                                <TableCell className="text-right">{production_year}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Generation</TableCell>
                                <TableCell className="text-right">{generation}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Fuel type</TableCell>
                                <TableCell className="text-right">{fuel_type}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Engine capacity</TableCell>
                                <TableCell className="text-right">{engine_capacity}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Engine power</TableCell>
                                <TableCell className="text-right">{engine_power}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Body type</TableCell>
                                <TableCell className="text-right">{body_type}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Gearbox</TableCell>
                                <TableCell className="text-right">{gearbox}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Transmission</TableCell>
                                <TableCell className="text-right">{transmission}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Mileage</TableCell>
                                <TableCell className="text-right">{mileage}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Condition</TableCell>
                                <TableCell className="text-right">{condition}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">From</TableCell>
                                <TableCell className="text-right">{platform}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Seller type</TableCell>
                                <TableCell className="text-right">{seller_type}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>

                    {googleMapEmbedUrl && (
                        <div style={{width: '100%', height: '350px', marginTop: '20px'}}>
                            <iframe
                                src={googleMapEmbedUrl}
                                width="100%"
                                height="100%"
                                style={{border: 0}}
                                allowFullScreen={true}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title="Car Location on Google Map"
                            ></iframe>
                        </div>
                    )}
                    {!googleMapEmbedUrl && map_link && (
                        <div className="mt-4 text-sm text-red-500">
                            Could not display map. Invalid map link provided.
                        </div>
                    )}
                    {!map_link && (
                        <div className="mt-4 text-sm text-neutral-500">
                            No map location available for this listing.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Page;