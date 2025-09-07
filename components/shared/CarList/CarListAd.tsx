import React from 'react';
import {Card, CardTitle} from "@/components/ui/card";
import {getBodyTypeLabel, getFuelTypeLabel, getGearBoxLabelType} from "@/features/getTypesLabels";
import Link from "next/link";
import {ICarAdd} from "@/types/Car";
import CarAdImage from "@/components/shared/CarList/CarAdImage";
import {t} from 'i18next';
import {Avatar, AvatarImage, Separator} from "@/components/ComponentsProvider";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {useUserStore} from "@/store/user/userStore";

dayjs.extend(utc);

const CarListAd = ({carAd}: { carAd: ICarAdd }) => {
    const favorite_data = useUserStore(state => state.data.favorite)

    // Локальная дата с корректировкой для OLX
    const formattedDate = carAd.post_date
        ? dayjs(carAd.post_date)
            .add(carAd.platform === "olx" ? 2 : 0, "hour")
            .format("YYYY-MM-DD HH:mm")
        : "";


    return (
        <>
            <Link href={`/en/car/${carAd.id}`} key={carAd.id} className="block w-full">
                <Card className={`${favorite_data.includes(carAd.id) && "bg-primary/25"}`}>
                    <CardTitle>
                        <div className={`flex items-center justify-between gap-2`}>
                            <div className={`flex items-center gap-2`}>
                                {
                                    carAd.platform === "olx"
                                        ?
                                        <Avatar className={`w-9 h-6`}>
                                            <AvatarImage
                                                src={`https://upload.wikimedia.org/wikipedia/commons/4/42/OLX_New_Logo.png`}/>
                                        </Avatar>
                                        :
                                        <Avatar className={`w-14 h-6`}>
                                            <AvatarImage
                                                src={`https://prowly-prod.s3.eu-west-1.amazonaws.com/uploads/landing_page_image/image/375764/37a4c1624960366798b450b042305934.png`}/>
                                        </Avatar>

                                }

                                <span className={`line-clamp-1`}>{carAd.title}</span>
                            </div>
                            <div className={`flex items-center gap-2`}>
                                <span
                                    className={`text-base text-primary text-nowrap font-semibold`}>{carAd.price.toLocaleString()} zl</span>
                            </div>
                        </div>
                        <div>
                            <p className={`text-neutral-500 text-xs flex items-center gap-2`}>
                                {/*{carAd.platform} */}
                                {t(`from`)} {formattedDate}
                            </p>
                        </div>
                    </CardTitle>
                    <hr/>
                    <div className={`grid grid-cols-[145px_1fr] gap-2`}>

                        <CarAdImage carAd={carAd}/>

                        <div className={`flex w-full gap-2 flex-col items-start`}>
                            <div className={`grid grid-cols-[25px_1fr_5px_1fr] text-xs  gap-2 items-center rounded`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width={`1.5em`} height={`1.5em`} fill="none"
                                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                                    <path fill="currentColor" fillRule="evenodd"
                                          d="M16 18H12.83l-2-2H8v-6h8v8Zm5-9-1 1v2.042h-2V9l-1-1h-4V6h2.5l1-1-1-1h-7l-1 1 1 1H11v2H7L6 9v3H4v-2L3 9l-1 1v6l1 1 1-1v-2h2v3l1 1h3l2 2h5l1-1v-5h2v2l1 1 1-1v-6l-1-1Z"
                                          clipRule="evenodd"></path>
                                </svg>

                                <p>{carAd.engine_capacity || "None"}</p>
                                <Separator orientation="vertical"/>
                                <p>{carAd.engine_power || "None"}</p>
                            </div>

                            <div className={`grid grid-cols-[25px_1fr_5px_1fr] text-xs gap-2 items-center rounded`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width={`1.5em`} height={`1.5em`}
                                     fill="none"
                                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                                    <path fill="currentColor" d="M10.997 9H6V5h4.997v4Z"></path>
                                    <path fill="currentColor" fillRule="evenodd"
                                          d="M16 3.042h3.408L22 5.579v13.422C22 20.206 21.201 22 19 22c-2.2 0-3-1.794-3-3v-6c0-.806-.55-.989-1.011-1H14v10H3V3.001l1-1h9l1 1V10h1c1.206 0 3 .799 3 3v6c.012.449.195 1 1 1 .806 0 .988-.55 1-1.011V6.421l-1.408-1.379H16l-1-1.041 1-.959ZM12 20H5V4.001h7V20Z"
                                          clipRule="evenodd"></path>
                                </svg>

                                <p>{getFuelTypeLabel(carAd.fuel_type || "None")}</p>
                                <Separator orientation="vertical"/>
                                <p>{getGearBoxLabelType(carAd.gearbox || "None")}</p>
                            </div>

                            <div className={`grid grid-cols-[25px_1fr_5px_1fr] text-xs gap-2 items-center rounded`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width={`1.5em`} height={`1.5em`} fill="none"
                                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                                    <path fill="currentColor"
                                          d="M2 20.004 7.898 4h2.13L4.13 20.004H2ZM13.999 4l5.872 16.004h2.13L16.13 4h-2.131ZM11.002 8h2V6h-2v2ZM11.002 12.999h2v-3h-2v3ZM13.002 19h-2v-4h2v4Z"></path>
                                </svg>
                                <p className={`text-xs`}>{carAd.mileage?.toLocaleString()} km</p>
                            </div>
                            <div className={`grid grid-cols-[25px_1fr_5px_1fr] text-xs gap-2 items-center rounded`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width={`1.5em`} height={`1.5em`} fill="none"
                                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                                    <path fill="currentColor" fillRule="evenodd"
                                          d="M17 7h4c.258.194.433.387.632.608.11.121.226.25.368.392v6l-1 1h-3v-1c0-.6-.4-1-1-1s-1 .4-1 1v1H8v-1c0-.6-.4-1-1-1s-1 .4-1 1v1H3l-1-1V7l3.8-5H16l1 5Zm2.8 6h.2V9h-4.7L15 7.3 14.3 4H6.7L4 7.6V13h.2c.4-1.2 1.5-2 2.8-2 1.3 0 2.4.8 2.8 2h4.4c.4-1.2 1.5-2 2.8-2 1.3 0 2.4.8 2.8 2ZM7 16c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.4-3-3-3Zm0 4c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.5 1-1 1Zm10-4c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.4-3-3-3Zm0 4c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.5 1-1 1Z"
                                          clipRule="evenodd"></path>
                                </svg>
                                <p className={`text-xs text-nowrap`}>{getBodyTypeLabel(carAd.body_type || "None")}</p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <p>{t(`${carAd.seller_type}`)} - {carAd.seller_name}</p>
                        <p className={`text-neutral-500 text-xs`}>{carAd.location_text}</p>
                    </div>
                </Card>
            </Link>
        </>
    );
};

export default CarListAd;