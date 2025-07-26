import React from 'react';
import {Button, Skeleton} from "@/components/ComponentsProvider";
import {ICarAd} from "@/types/Car";
import {useTranslation} from "react-i18next";
import {ExternalLink, HeartPlus} from "lucide-react";
import Link from "next/link";

interface Props {
    data: ICarAd | undefined;
    isLoading: boolean;
}

const AdButtons: React.FC<Props> = ({data, isLoading}) => {
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <Skeleton className={`w-full h-50`}/>
        )
    }

    if (!data) return null;

    return (
        <div className={`grid grid-cols-[1fr_125px] gap-2`}>
            <Link href={data.url}><Button className={`w-full`}><ExternalLink /> {t('open_original')}</Button></Link>
            <Button variant={`outline`} className={`w-full`}><HeartPlus /> {t('favorite')}</Button>
        </div>
    );
};

export default AdButtons;