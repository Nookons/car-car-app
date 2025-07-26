import {Badge, Table, TableBody, TableCaption, TableCell, TableRow } from '@/components/ComponentsProvider';
import React from 'react';
import {IUserFull} from "@/types/User";
import dayjs from "dayjs";
import {t} from "i18next";

const UserSearchSettings = ({data, isLoading}: {data: IUserFull | null | undefined, isLoading: boolean}) => {

    if (isLoading) return null;
    if (!data) return null;

    return (
        <div className={`mt-4`}>
            <p className={`text-neutral-500 text-xs`}>{t("change_setting_not_available")}</p>

            <Table className={`mt-2`}>
                <TableCaption>User search settings</TableCaption>
                <TableBody>
                    <TableRow>
                        <TableCell className="font-medium">{t("brand")}</TableCell>
                        <TableCell className="text-right">
                            <Badge variant={!data.brand ? 'destructive' : 'default'}>
                                {data.brand ? data.brand.toUpperCase() : "none"}
                            </Badge>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">{t("model")}</TableCell>
                        <TableCell className="text-right">
                            <Badge variant={!data.model ? 'destructive' : 'default'}>
                                {data.model ? data.model.toUpperCase() : "none"}
                            </Badge>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">{t("min_price")}</TableCell>
                        <TableCell className="text-right">{data.min_price}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">{t("max_price")}</TableCell>
                        <TableCell className="text-right">{data.max_price}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">{t("min_year")}</TableCell>
                        <TableCell className="text-right">{data.min_year || '2000'}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">{t("max_year")}</TableCell>
                        <TableCell className="text-right">{data.max_year || dayjs().format('YYYY')}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">{t("saved_location")}</TableCell>
                        <TableCell className="text-right">
                            {data.locationstring.length > 20
                                ? `${data.locationstring.slice(0, 20)}...`
                                : data.locationstring
                            }
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">{t("search_range")}</TableCell>
                        <TableCell className="text-right">{data.from_user_range} km</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">{t("mileage")}</TableCell>
                        <TableCell className="text-right">{data.max_mileage || '0'}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">{t("seller_type")}</TableCell>
                        <TableCell className="text-right">{data.seller_types || 'none'}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">{t("picked_platforms")}</TableCell>
                        <TableCell className="text-right">{data.platform_types || 'none'}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">{t("condition")}</TableCell>
                        <TableCell className="text-right">{data.condition_types || 'none'}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    );
};

export default UserSearchSettings;