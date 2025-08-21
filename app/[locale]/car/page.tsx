'use client';
import {useUserStore} from "@/store/user/userStore";
import {useQuery} from "@tanstack/react-query";
import {getListForUser} from "@/features/cars/getListForUser";
import {Card, CardTitle, Skeleton, Badge} from "@/components/ComponentsProvider";
import Link from "next/link";
import React, {useEffect} from "react";
import {Car} from 'lucide-react'
import { useTranslation } from 'react-i18next';
import {getFuelTypeLabel} from "@/features/getTypesLabels";

export default function Page() {
    const { t } = useTranslation();
    const user_data = useUserStore(state => state.user_data)

    const {data, isLoading, isError, error} = useQuery<any, Error>({
        queryKey: ['test', user_data.user_id],
        queryFn: () => getListForUser({ uid: user_data.user_id.toString(), pageNumber: 1 }), // ✅
        enabled: !!user_data.user_id,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        console.log(data);
    }, [data]);


    if (isLoading || !user_data.user_id) {
        return (
            <div className={`p-4 flex flex-col gap-2`}>
                {Array.from({ length: 10 }).map((_, index) => (
                    <Skeleton className={`w-full h-48 mb-2`} />
                ))}
            </div>
        )

    }

    if (!data) return <div>Error</div>;

    return (
        <div className="p-2 flex flex-col gap-2">
            {data.map((item: any) => {

                return (
                    <Link href={`/en/car/${item.id}`} key={item.id} className="block">
                        <Card>
                            <CardTitle className={`flex items-center justify-between gap-2`}>
                                <span>{item.title}</span>
                                <Car />
                            </CardTitle>
                            <hr/>
                            <div className={`grid grid-cols-[145px_1fr] gap-2`}>
                                <div className="rounded h-30 overflow-hidden mb-2">
                                    <img
                                        src={item.images[0].replace('s=148x110', 's=800x600') || ''}
                                        alt={`${item.brand} ${item.model}`}
                                        className="w-full h-full object-fill"
                                    />
                                </div>

                               <div className={`flex flex-col gap-2`}>
                                   <div className={`grid grid-cols-[25px_1fr] gap-4`}>
                                       <svg xmlns="http://www.w3.org/2000/svg" width={`2em`} height={`2em`} fill="none"
                                            viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                                           <path fill="currentColor" fillRule="evenodd"
                                                 d="M16 18H12.83l-2-2H8v-6h8v8Zm5-9-1 1v2.042h-2V9l-1-1h-4V6h2.5l1-1-1-1h-7l-1 1 1 1H11v2H7L6 9v3H4v-2L3 9l-1 1v6l1 1 1-1v-2h2v3l1 1h3l2 2h5l1-1v-5h2v2l1 1 1-1v-6l-1-1Z"
                                                 clipRule="evenodd"></path>
                                       </svg>
                                       <div className={`space-y-1 space-x-1`}>
                                           <Badge variant={`outline`}>{item.engine_capacity}</Badge>
                                           <Badge variant={`outline`}>{item.engine_power}</Badge>
                                           <Badge variant={`outline`}>{getFuelTypeLabel(item.fuel_type)}</Badge>
                                       </div>
                                   </div>
                               </div>
                            </div>
                        </Card>
                    </Link>
                )
            })}
        </div>
    );
}
