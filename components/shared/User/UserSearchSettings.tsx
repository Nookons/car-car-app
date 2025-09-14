import {
    Badge,
    Card,
    CardTitle,
} from '@/components/ComponentsProvider';
import React from 'react';
import {IUserFull} from "@/types/User";
import {t} from "i18next";
import {CalendarRange, Car, HandCoins, MapPinned, MoveRight} from 'lucide-react';

const UserSearchSettings = ({data, isLoading}: { data: IUserFull | null | undefined, isLoading: boolean }) => {
    if (isLoading) return null;
    if (!data) return null;

    const brands = data.brand ?? [];
    const models = data.model ?? [];
    const conditions = data.condition_types ?? [];

    const minPrice = data.min_price ?? 0;
    const maxPrice = data.max_price ?? 99999999;
    const minYear = data.min_year ?? "None";
    const maxYear = data.max_year ?? "None";
    const searchRange = data.from_user_range ?? 0;
    const maxMileage = data.max_mileage ?? 0;
    const sellerTypes = data.seller_types ?? [];
    const platformTypes = data.platform_types ?? [];

    return (
        <div className="mt-4">
            {/* Brand */}
            <Card className="mt-2">
                <CardTitle className="flex justify-between items-center gap-2">
                    <Car/>
                    <p className="text-xs text-neutral-500">Cars search settings</p>
                </CardTitle>
                <div className="flex flex-col gap-2 mt-2">
                    <div className="flex flex-col gap-2">
                        <article className="text-nowrap text-neutral-500">{t("brand")}:</article>
                        {brands.length > 0 ? (
                            brands.length < 3 ? (
                                <div className={`grid grid-cols-${brands.length} items-center gap-2 flex-wrap`}>
                                    {brands.map((br_local, index) => (
                                        <Badge key={`${br_local}-${index}`} className="w-full" variant="outline">
                                            <span className="font-bold text-base">{br_local}</span>
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 flex-wrap">
                                    {brands.map((br_local, index) => (
                                        <Badge key={`${br_local}-${index}`} variant="outline">
                                            <span className="font-bold text-base">{br_local}</span>
                                        </Badge>
                                    ))}
                                </div>
                            )
                        ) : (
                            <span className="font-bold text-center w-full text-base">None</span>
                        )}
                    </div>
                    <hr/>

                    {/* Model */}
                    <div className="flex flex-col gap-2">
                        <article className="text-nowrap text-neutral-500">{t("model")}:</article>
                        {models.length > 0 ? (
                            models.length < 3 ? (
                                <div className={`grid grid-cols-${models.length} items-center gap-2 flex-wrap`}>
                                    {models.map((md_local, index) => (
                                        <Badge key={`${md_local}-${index}`} className="w-full" variant="outline">
                                            <span className="font-bold text-base">{md_local}</span>
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 flex-wrap">
                                    {models.map((md_local, index) => (
                                        <Badge key={`${md_local}-${index}`} variant="outline">
                                            <span className="font-bold text-base">{md_local}</span>
                                        </Badge>
                                    ))}
                                </div>
                            )
                        ) : (
                            <span className="font-bold text-center w-full text-base">None</span>
                        )}
                    </div>
                </div>
                <hr/>

                {/* Price */}
                <div className="flex mt-4 justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                        <HandCoins/>
                        <p className="text-xs text-neutral-500">{t(`telegram_form.price_range`)}</p>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <span
                            className="font-bold text-base">{minPrice === 0 ? '0 zl' : minPrice.toLocaleString() + ' zl'}</span>
                        <MoveRight/>
                        <span
                            className="font-bold text-base">{maxPrice === 99999999 ? 'None' : maxPrice.toLocaleString() + ' zl'}</span>
                    </div>
                </div>

                {/* Years */}
                <div className="flex justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                        <CalendarRange/>
                        <p className="text-xs text-neutral-500">{t(`telegram_form.years_range`)}</p>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-base">{minYear}</span>
                        <MoveRight/>
                        <span className="font-bold text-base">{maxYear}</span>
                    </div>
                </div>

                {/* Search range */}
                <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                        <MapPinned/>
                        <p className="text-xs text-neutral-500">{t("search_range")}</p>
                    </div>
                    <span className="font-bold text-base flex items-center gap-2">
                        <span>0 km</span>
                        <MoveRight/>
                        <span>{searchRange.toLocaleString()} km</span>
                    </span>
                </div>
            </Card>



            <p className="text-neutral-500 text-xs my-4">{t("change_setting_not_available")}</p>

            {/* Optional: Mileage, seller types, platforms, conditions */}
            {/* Можно добавить аналогично с проверкой на пустые массивы */}
        </div>
    );
};

export default UserSearchSettings;
