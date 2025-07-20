'use client';
import React from 'react';
import {useQuery} from "@tanstack/react-query";
import {IUserFull} from "@/types/UserTypes";
import {Table, TableBody, TableCaption, TableCell, TableRow} from "@/components/ui/table";
import dayjs from "dayjs";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";

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

    const {data, isLoading, isError} = useQuery<IUserFull | null>({
        queryKey: [uid],
        queryFn: () => fetchData(uid),
        staleTime: 5 * 60 * 1000,
    });

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!data || isError) {
        return <div>Error</div>;
    }


    return (
        <div className={`px-1`}>
            <div className={`flex flex-wrap items-center gap-6 py-8`}>
                <Avatar className={`size-[105px]`}>
                    <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                    <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <div>
                    <p className={`text-neutral-500 text-xs`}>Hello, <span className={`text-base font-bold text-foreground`}>{data.username}</span></p>
                    <p className={`text-neutral-500 text-xs`}>Name: <span className={`text-base font-bold text-foreground`}>{data.first_name || ''} {data.last_name || ''}</span></p>
                    <p className={`text-neutral-500 text-xs`}>Language: <span className={`text-base font-bold text-foreground`}>{data.language_code}</span></p>
                    <p className={`text-neutral-500 text-xs`}>ID: <span className={`text-base font-bold text-foreground`}>{data.id}</span></p>
                </div>
            </div>
            <div className={`mt-4`}>
                <p className={`text-neutral-500 text-xs`}>Change your setting available only from telegram right now. In next update you will be able to do this here )</p>

                <Table className={`mt-2`}>
                    <TableCaption>User search settings</TableCaption>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium">Model</TableCell>
                            <TableCell className="text-right">{data.model}</TableCell>
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
                            <TableCell className="text-right">{data.locationstring}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Search Range</TableCell>
                            <TableCell className="text-right">{data.from_user_range} km</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">max_mileage</TableCell>
                            <TableCell className="text-right">{data.max_mileage || '0'}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">seller_types</TableCell>
                            <TableCell className="text-right">{data.seller_types || 'none'}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">platform_types</TableCell>
                            <TableCell className="text-right">{data.platform_types || 'none'}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">condition_types</TableCell>
                            <TableCell className="text-right">{data.condition_types || 'none'}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default Page;