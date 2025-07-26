import {Skeleton, Table, TableBody, TableCell, TableRow} from '@/components/ComponentsProvider';
import React from 'react';
import {ICarAdd} from "@/types/Car";
import {useTranslation} from "react-i18next";
import {
    getBodyTypeLabel, getColorLabel,
    getConditionLabel, getFuelTypeLabel,
    getGearBoxLabelType,
    getSellerTypeLabel,
    getTransmissionTypeLabel
} from "@/feathers/getTypesLabels";

interface Props {
    data: ICarAdd | undefined;
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
                    <TableCell className="font-medium text-neutral-500">{t("brand")}</TableCell>
                    <TableCell className="text-right font-semibold">
                        {data.brand.length > 20
                            ? `${data.brand.substring(0, 20)}...`
                            : data.brand
                        }
                    </TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium text-neutral-500">{t("model")}</TableCell>
                    <TableCell className="text-right font-semibold">
                        {data.model.length > 20
                            ? `${data.model.substring(0, 20)}...`
                            : data.model
                        }
                    </TableCell>
                </TableRow>
                {data.version !== "unknown" &&
                    <TableRow>
                        <TableCell className="font-medium text-neutral-500">{t("version")}</TableCell>
                        <TableCell className="text-right font-semibold">
                            {data.version.length > 20
                                ? `${data.version.substring(0, 20)}...`
                                : data.version
                            }
                        </TableCell>
                    </TableRow>
                }
                <TableRow>
                    <TableCell className="font-medium text-neutral-500">{t("color")}</TableCell>
                    <TableCell className="text-right font-semibold">{getColorLabel(data.color)}</TableCell>
                </TableRow>
                {data.door_count &&
                    <TableRow>
                        <TableCell className="font-medium text-neutral-500">{t("door_count")}</TableCell>
                        <TableCell className="text-right font-semibold">{data.door_count}</TableCell>
                    </TableRow>
                }
                {data.seats_count &&
                    <TableRow>
                        <TableCell className="font-medium text-neutral-500">{t("seats_count")}</TableCell>
                        <TableCell className="text-right font-semibold">{data.seats_count}</TableCell>
                    </TableRow>
                }
                <TableRow>
                    <TableCell className="font-medium text-neutral-500">{t("production_year")}</TableCell>
                    <TableCell className="text-right font-semibold">{data.production_year}</TableCell>
                </TableRow>
                {data.generation !== "unknown" &&
                    <TableRow>
                        <TableCell className="font-medium text-neutral-500">{t("generation")}</TableCell>
                        <TableCell className="text-right font-semibold">{data.generation}</TableCell>
                    </TableRow>
                }
                <TableRow>
                    <TableCell className="font-medium text-neutral-500">{t("fuel_type")}</TableCell>
                    <TableCell className="text-right font-semibold">{getFuelTypeLabel(data.fuel_type)}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium text-neutral-500">{t("engine_capacity")}</TableCell>
                    <TableCell className="text-right font-semibold">{data.engine_capacity}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium text-neutral-500">{t("engine_power")}</TableCell>
                    <TableCell className="text-right font-semibold">{data.engine_power}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium text-neutral-500">{t("body_type")}</TableCell>
                    <TableCell className="text-right font-semibold">{getBodyTypeLabel(data.body_type)}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium text-neutral-500">{t("gearbox")}</TableCell>
                    <TableCell className="text-right font-semibold">{getGearBoxLabelType(data.gearbox)}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium text-neutral-500">{t("transmission")}</TableCell>
                    <TableCell className="text-right font-semibold">{getTransmissionTypeLabel(data.transmission)}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium text-neutral-500">{t("mileage")}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(data.mileage).toLocaleString()} km</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium text-neutral-500">{t("condition")}</TableCell>
                    <TableCell className="text-right font-semibold">{getConditionLabel(data.condition)}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium text-neutral-500">{t("from")}</TableCell>
                    <TableCell className="text-right font-semibold">{data.platform}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium text-neutral-500">{t("seller_type")}</TableCell>
                    <TableCell className="text-right font-semibold">{getSellerTypeLabel(data.seller_type)}</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    );
};

export default FullParams;