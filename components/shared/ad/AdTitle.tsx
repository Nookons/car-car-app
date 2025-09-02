import React from 'react';
import { ICarAdd } from "@/types/Car";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ComponentsProvider";
import {useTranslation} from "react-i18next";
import {getConditionLabel, getSellerTypeLabel} from "@/features/getTypesLabels";
import dayjs from "dayjs";


interface Props {
    data: ICarAdd | undefined;
    isLoading: boolean;
}

const AdTitle: React.FC<Props> = ({ data, isLoading }) => {
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <div className="grid grid-cols-[1fr_125px] gap-2 my-4 w-full">
                <Skeleton className="w-full h-16" />
                <Skeleton className="w-full h-8" />
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="flex justify-between gap-2 mb-4">
            <div>
                <h1 className="text-lg font-bold line-clamp-1">{data.title}</h1>
                <p className="text-neutral-500 text-xs font-semibold">{getSellerTypeLabel(data.seller_type)}</p>
                <p className="text-neutral-500 text-xs font-semibold">{getConditionLabel(data.new_used?.toLowerCase() || "")} · {dayjs(data.year).format("YYYY")}</p>
            </div>
            <div>
                <Badge variant="outline" className="font-bold text-base">
                    {data.price.toLocaleString()} zl
                </Badge>
            </div>
        </div>
    );
};

export default AdTitle;
