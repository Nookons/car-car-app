import {Skeleton, Table, TableBody, TableCell, TableRow} from '@/components/ComponentsProvider';
import React from 'react';
import {ICarAd} from "@/types/Car";
import {useTranslation} from "react-i18next";

interface Props {
    data: ICarAd | undefined;
    isLoading: boolean;
}

const FullParams: React.FC<Props> = ({data, isLoading}) => {
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <div className={`grid grid-cols-3 gap-2 mt-4 text-sm text-center`}>
                <Skeleton className={`w-full h-20`}/>
                <Skeleton className={`w-full h-20`}/>
                <Skeleton className={`w-full h-20`}/>
                <Skeleton className={`w-full h-20`}/>
                <Skeleton className={`w-full h-20`}/>
                <Skeleton className={`w-full h-20`}/>
            </div>
        )
    }

    if (!data) return null;

    return (
        <Table className={`mt-8`}>
            <TableBody>
                <TableRow>
                    <TableCell className="font-medium">{t("brand")}</TableCell>
                    <TableCell className="text-right">{data.brand}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("model")}</TableCell>
                    <TableCell className="text-right">{data.model}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("version")}</TableCell>
                    <TableCell className="text-right">{data.version}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("color")}</TableCell>
                    <TableCell className="text-right">{data.color}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("door_count")}</TableCell>
                    <TableCell className="text-right">{data.door_count}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("seats_count")}</TableCell>
                    <TableCell className="text-right">{data.seats_count}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("production_year")}</TableCell>
                    <TableCell className="text-right">{data.production_year}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("generation")}</TableCell>
                    <TableCell className="text-right">{data.generation}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("fuel_type")}</TableCell>
                    <TableCell className="text-right">{data.fuel_type}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("engine_capacity")}</TableCell>
                    <TableCell className="text-right">{data.engine_capacity}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("engine_power")}</TableCell>
                    <TableCell className="text-right">{data.engine_power}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("body_type")}</TableCell>
                    <TableCell className="text-right">{data.body_type}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("gearbox")}</TableCell>
                    <TableCell className="text-right">{data.gearbox}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("transmission")}</TableCell>
                    <TableCell className="text-right">{data.transmission}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("mileage")}</TableCell>
                    <TableCell className="text-right">{data.mileage}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("condition")}</TableCell>
                    <TableCell className="text-right">{data.condition}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("from")}</TableCell>
                    <TableCell className="text-right">{data.platform}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium">{t("seller_type")}</TableCell>
                    <TableCell className="text-right">{data.seller_type}</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    );
};

export default FullParams;