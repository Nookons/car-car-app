import React from 'react';
import { ICarAd } from "@/types/Car";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ComponentsProvider";
import {useTranslation} from "react-i18next";


interface Props {
    data: ICarAd | undefined;
    isLoading: boolean;
}

const AdTitle: React.FC<Props> = ({ data, isLoading }) => {
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <div className="grid grid-cols-[1fr_125px] gap-2 mb-4 w-full">
                <Skeleton className="w-full h-16" />
                <Skeleton className="w-full h-8" />
            </div>
        );
    }

    if (!data) return null;

    function getConditionLabel(type: string) {
        switch (type.toLowerCase()) {
            case "nowy":
                return t("new")
            case "używany":
                return t("used")
            default:
                return ""
        }
    }

    function getSellerType(type: string) {
        console.log(type.toLowerCase());
        switch (type.toLowerCase()) {
            case "firma":
                return t("firma")
            case "autoryzowany dealer":
                return t("dealer")
            case "osoba prywatna":
                return t("private_person")
            default:
                return ""
        }
    }

    return (
        <div className="flex justify-between gap-2 mb-4">
            <div>
                <h1 className="text-lg font-bold line-clamp-1">{data.title}</h1>
                <p className="text-neutral-500 text-xs font-semibold">{getSellerType(data.seller_type)}</p>
                <p className="text-neutral-500 text-xs font-semibold">{getConditionLabel(data.condition)} · {data.production_year}</p>
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
