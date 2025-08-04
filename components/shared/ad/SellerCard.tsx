import React from 'react';
import {ICarAdd} from "@/types/Car";
import {useTranslation} from "react-i18next";
import {Skeleton} from "@/components/ui/skeleton";
import {Handshake} from "lucide-react";

interface Props {
    data: ICarAdd | undefined;
    isLoading: boolean;
}

const SellerCard: React.FC<Props> = ({data, isLoading}) => {
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <div className={`grid grid-cols-3 gap-2 mt-4 text-sm text-center`}>
                <Skeleton className={`w-full h-20`}/>
            </div>
        )
    }

    return (
        <div className={`w-full bg-primary/25 rounded p-2`}>
            <h1 className={`flex items-center gap-2 text-xs`}><Handshake size={20} /> {data?.seller_name} ({data?.seller_type.toUpperCase()})</h1>
        </div>
    );
};

export default SellerCard;