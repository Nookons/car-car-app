import React from 'react';
import {Button, Skeleton} from "@/components/ComponentsProvider";
import {ICarAd} from "@/types/Car";
import {useTranslation} from "react-i18next";

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
        <div className={`space-y-2`}>
            <Button className={`w-full`}>{t('favorite')}</Button>
            <Button variant={`outline`} className={`w-full`}>{t('back')}</Button>
        </div>
    );
};

export default AdButtons;