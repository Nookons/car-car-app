'use client';
import React, { useEffect, useState } from 'react';
import {useQuery} from "@tanstack/react-query";
import {IUserFull} from "@/types/UserTypes";
import {Table, TableBody, TableCaption, TableCell, TableRow} from "@/components/ui/table";
import dayjs from "dayjs";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {ArrowBigLeftDash, HandHelping, Undo2} from "lucide-react";
import {useRouter} from "next/navigation";
import UserMainSkeleton from "@/Skeletons/User/UserMainSkeleton";

type PageProps = {
    params: Promise<{
        uid: string;
    }>;
};

async function fetchData(uid: string) {
    return await fetch(`https://car-car-app.vercel.app/api/get-user-data?uid=${uid}`)
        .then((res) => res.json())
        .then((data) => {
            return data as IUserFull
        })
}

const Page = ({ params }: PageProps) => {
    const resolvedParams = React.use(params);
    const uid = resolvedParams.uid;

    const router = useRouter();




    const {data, isLoading, isError} = useQuery<IUserFull | null>({
        queryKey: [uid],
        queryFn: () => fetchData(uid),
        staleTime: 5 * 60 * 1000,
    });


    if (isLoading) {
        return <UserMainSkeleton />;
    }

    if (!data || isError) {
        return <div>Error</div>;
    }


    return (
        <div className={`px-4`}>
            <div className={`flex flex-wrap items-center gap-6 py-8`}>
                <Avatar className={`size-[85px]`}>
                    <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                    <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <div>
                    <p className={`font-bold text-xl`}>{data.first_name || ""} {data.last_name || ""}</p>
                    <p className={`text-neutral-500`}>{data.username}</p>
                </div>
            </div>
            <div className={`space-y-2`}>
                <Button className={`w-full`}><HandHelping />Support Contact</Button>
                <Button onClick={() => router.back()} variant={`outline`} className={`w-full flex items-center gap-2`}><ArrowBigLeftDash /> <p>Back</p></Button>
            </div>
            <div className={`mt-4`}>
                <p className={`text-neutral-500 text-xs`}>Change your setting available only from telegram right now. In next update you will be able to do this here )</p>

                <Table className={`mt-2`}>
                    <TableCaption>User search settings</TableCaption>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium">Brand</TableCell>
                            <TableCell className="text-right">
                                <Badge variant={!data.brand ? 'destructive' : 'default'}>
                                    {data.brand ? data.brand.toUpperCase() : "none"}
                                </Badge>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Model</TableCell>
                            <TableCell className="text-right">
                                <Badge variant={!data.model ? 'destructive' : 'default'}>
                                    {data.model ? data.model.toUpperCase() : "none"}
                                </Badge>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Min Price</TableCell>
                            <TableCell className="text-right">{data.min_price}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Max Price</TableCell>
                            <TableCell className="text-right">{data.max_price}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Min Year</TableCell>
                            <TableCell className="text-right">{data.min_year || '2000'}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Max Year</TableCell>
                            <TableCell className="text-right">{data.max_year || dayjs().format('YYYY')}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Saved Location</TableCell>
                            <TableCell className="text-right">
                                {data.locationstring.length > 30
                                    ? `${data.locationstring.slice(0, 30)}...`
                                    : data.locationstring
                                }
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Search Range</TableCell>
                            <TableCell className="text-right">{data.from_user_range} km</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Millage</TableCell>
                            <TableCell className="text-right">{data.max_mileage || '0'}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Seller</TableCell>
                            <TableCell className="text-right">{data.seller_types || 'none'}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Platforms</TableCell>
                            <TableCell className="text-right">{data.platform_types || 'none'}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Condition</TableCell>
                            <TableCell className="text-right">{data.condition_types || 'none'}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default Page;