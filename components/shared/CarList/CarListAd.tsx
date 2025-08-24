import React from 'react';
import {Card, CardTitle} from "@/components/ui/card";
import {Car, HeartPlus} from "lucide-react";
import {Badge} from "@/components/ui/badge";
import {getFuelTypeLabel} from "@/features/getTypesLabels";
import Link from "next/link";
import {ICarAdd} from "@/types/Car";
import CarAdImage from "@/components/shared/CarList/CarAdImage";
import {t} from 'i18next';

const CarListAd = ({carAd}: { carAd: ICarAdd }) => {
    return (
        <Link href={`/en/car/${carAd.id}`} key={carAd.id} className="block w-full">
            <Card>
                <CardTitle className={`flex items-center justify-between gap-2`}>
                    <span className={`line-clamp-1`}>{carAd.title}</span>
                    <div className={`flex items-center gap-2`}>
                        <span className={`text-xl text-nowrap font-semibold`}>{carAd.price.toLocaleString()} zl</span>
                        <HeartPlus size={20}/>
                    </div>
                </CardTitle>
                <hr/>
                <div className={`grid grid-cols-[145px_1fr] gap-2`}>

                    <CarAdImage carAd={carAd}/>

                    <div className={`flex flex-col items-start`}>
                        {/*<span>{t(`${carAd.seller_type}`)}</span>
                        <span className={`line-clamp-1`}>{carAd.seller_name}</span>*/}
                        <div className={`p-2 flex flex-wrap gap-2 items-center rounded`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width={`1em`} height={`1em`} fill="none"
                                 viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                                <path fill="currentColor" fillRule="evenodd"
                                      d="M16 18H12.83l-2-2H8v-6h8v8Zm5-9-1 1v2.042h-2V9l-1-1h-4V6h2.5l1-1-1-1h-7l-1 1 1 1H11v2H7L6 9v3H4v-2L3 9l-1 1v6l1 1 1-1v-2h2v3l1 1h3l2 2h5l1-1v-5h2v2l1 1 1-1v-6l-1-1Z"
                                      clipRule="evenodd"></path>
                            </svg>
                            <Badge variant={`outline`}>{carAd.engine_capacity}</Badge>
                            <Badge variant={`outline`}>{carAd.engine_power}</Badge>
                            <Badge variant={`outline`}>{getFuelTypeLabel(carAd.fuel_type || "None")}</Badge>
                        </div>

                        <div className={`p-2 flex flex-wrap gap-2 items-center rounded`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width={`1em`} height={`1em`} fill="none"
                                 viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                                <path fill="currentColor"
                                      d="M2 20.004 7.898 4h2.13L4.13 20.004H2ZM13.999 4l5.872 16.004h2.13L16.13 4h-2.131ZM11.002 8h2V6h-2v2ZM11.002 12.999h2v-3h-2v3ZM13.002 19h-2v-4h2v4Z"></path>
                            </svg>
                            <Badge variant={`outline`}>{carAd.mileage?.toLocaleString()} km</Badge>
                        </div>
                    </div>
                </div>
                <div>
                    <p>{t(`${carAd.seller_type}`)} - {carAd.seller_name}</p>
                    <p className={`text-neutral-500 text-xs`}>{carAd.location_text}</p>
                </div>
            </Card>
        </Link>
    );
};

export default CarListAd;