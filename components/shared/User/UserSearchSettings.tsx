import {
    Badge,
    Card,
    CardTitle, Slider,
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableRow
} from '@/components/ComponentsProvider';
import React from 'react';
import {IUserFull} from "@/types/User";
import {t} from "i18next";
import {ArrowRightLeft, CalendarRange, Car, HandCoins, MapPinned, MoveRight } from 'lucide-react';

const UserSearchSettings = ({data, isLoading}: { data: IUserFull | null | undefined, isLoading: boolean }) => {
    if (isLoading) return null;
    if (!data) return null;


    return (
        <div className={`mt-4`}>
            <Card className={`mt-2`}>
                <CardTitle className={`flex justify-between items-center gap-2`}>
                    <Car/>
                    <p className={`text-xs text-neutral-500`}>Cars search settings</p>
                </CardTitle>
                <div className={`flex flex-col gap-2 mt-2`}>
                    <div className={`flex flex-col gap-2`}>
                        <article className={`text-nowrap text-neutral-500`}>{t("brand")}:</article>
                        {data.brand
                            ?
                            <>
                                {data.brand.length < 3
                                    ?
                                    <div className={`grid grid-cols-${data.brand.length} items-center gap-2 flex-wrap`}>
                                        {data.brand.map((br_local, index) => (
                                            <Badge key={`${br_local}-${index}`} className={`w-full`} variant={'outline'}>
                                                <span className={`font-bold text-base`}>{br_local}</span>
                                            </Badge>
                                        ))}
                                    </div>
                                    :
                                    <div className={`flex items-center gap-2 flex-wrap`}>
                                        {data.brand.map((br_local, index) => (
                                            <Badge key={`${br_local}-${index}`} variant={'outline'}>
                                                <span className={`font-bold text-base`}>{br_local}</span>
                                            </Badge>
                                        ))}
                                    </div>
                                }
                            </>
                            :
                            <Badge className={`w-full`} variant={'outline'}>
                                <span className={`font-bold text-base`}>None</span>
                            </Badge>
                        }
                    </div>
                    <div className={`flex flex-col gap-2`}>
                        <article className={`text-nowrap text-neutral-500`}>{t("model")}:</article>
                        {data.model
                            ?
                            <>
                                {data.model.length < 3
                                    ?
                                    <div className={`grid grid-cols-${data.model.length} items-center gap-2 flex-wrap`}>
                                        {data.model.map((br_local, index) => (
                                            <Badge key={`${br_local}-${index}`} className={`w-full`} variant={'outline'}>
                                                <span className={`font-bold text-base`}>{br_local}</span>
                                            </Badge>
                                        ))}
                                    </div>
                                    :
                                    <div className={`flex items-center gap-2 flex-wrap`}>
                                        {data.model.map((br_local, index) => (
                                            <Badge key={`${br_local}-${index}`} variant={'outline'}>
                                                <span className={`font-bold text-base`}>{br_local}</span>
                                            </Badge>
                                        ))}
                                    </div>
                                }
                            </>
                            :
                            <Badge className={`w-full`} variant={'outline'}>
                                <span className={`font-bold text-base`}>None</span>
                            </Badge>
                        }
                    </div>
                </div>
            </Card>

            <Card className={`mt-2`}>
                <div className={`flex justify-between gap-2`}>
                    <CardTitle className={`flex items-center gap-2`}>
                        <HandCoins />
                        <p className={`text-xs text-neutral-500`}>{t(`telegram_form.price_range`)}</p>
                    </CardTitle>
                    <div className={`flex items-center gap-2`}>
                        <div className={`flex gap-2 items-center justify-start`}>

                            {data.min_price === 0
                                ?
                                <Badge variant={`outline`}>
                                    <span className={`font-bold text-base`}>0 zl</span>
                                </Badge>
                                :
                                <Badge variant={`outline`}>
                                    <span className={`font-bold text-base`}>{data.min_price.toLocaleString()} zl</span>
                                </Badge>
                            }
                        </div>
                        <MoveRight />
                        <div className={`flex gap-2 items-center justify-end`}>
                            {data.max_price === 99999999
                                ?
                                <Badge variant={`outline`}>
                                    <span className={`font-bold text-base`}>None</span>
                                </Badge>
                                :
                                <Badge variant={`outline`}>
                                    <span className={`font-bold text-base`}>{data.max_price.toLocaleString()} zl</span>
                                </Badge>
                            }
                        </div>
                    </div>
                </div>
            </Card>

            <Card className={`mt-2`}>
                <div className={`flex justify-between gap-2`}>
                    <CardTitle className={`flex items-center gap-2`}>
                        <HandCoins />
                        <p className={`text-xs text-neutral-500`}>{t(`telegram_form.years_range`)}</p>
                    </CardTitle>
                    <div className={`flex items-center gap-2`}>
                        <div className={`flex gap-2 items-center justify-start`}>

                            {data.min_year
                                ?
                                <Badge variant={`outline`}>
                                    <span className={`font-bold text-base`}>{data.min_year}</span>
                                </Badge>
                                :
                                <Badge variant={`outline`}>
                                    <span className={`font-bold text-base`}>None</span>
                                </Badge>
                            }
                        </div>
                        <MoveRight />
                        <div className={`flex gap-2 items-center justify-end`}>
                            {data.max_year
                                ?
                                <Badge variant={`outline`}>
                                    <span className={`font-bold text-base`}>{data.max_year}</span>
                                </Badge>
                                :
                                <Badge variant={`outline`}>
                                    <span className={`font-bold text-base`}>None</span>
                                </Badge>
                            }
                        </div>
                    </div>
                </div>
            </Card>

            <Card className="mt-2">
                <CardTitle className="flex justify-between items-center gap-2">
                    <div className={`flex items-center gap-2`}>
                        <MapPinned />
                        <p className="text-xs text-neutral-500">{t("search_range")}</p>
                    </div>
                    <Badge variant={"outline"} className={`text-foreground `}>
                        <span className={`font-bold text-base flex items-center gap-2`}>0 km <MoveRight /> {data.from_user_range.toLocaleString()} km</span>
                    </Badge>
                </CardTitle>
            </Card>

            <p className={`text-neutral-500 text-xs my-4`}>{t("change_setting_not_available")}</p>

           {/* <Table className={`mt-2`}>
                <TableCaption>User search settings</TableCaption>
                <TableBody>

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
                        <TableCell className="text-right space-x-1">
                            {data.condition_types
                                ?
                                <>
                                    {data.condition_types.map((md_local, index) => (
                                        <Badge variant={"outline"}>
                                            {md_local}
                                        </Badge>
                                    ))}
                                </>
                                :
                                <div>

                                </div>
                            }
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>*/}
        </div>
    );
};

export default UserSearchSettings;