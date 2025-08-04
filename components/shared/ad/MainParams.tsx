import React from 'react';
import {ICarAdd} from "@/types/Car";
import {Skeleton} from "@/components/ui/skeleton";
import {getBodyTypeLabel, getFuelTypeLabel, getGearBoxLabelType} from "@/features/getTypesLabels";

interface Props {
    data: ICarAdd | undefined;
    isLoading: boolean;
    icon_size: number;
}

const MainParams: React.FC<Props> = ({data, isLoading, icon_size}) => {
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
        <div className={`grid grid-cols-3 gap-6 text-sm text-center`}>
            <div className={`flex flex-col items-center gap-2`}>
                <svg xmlns="http://www.w3.org/2000/svg" width={`${icon_size}em`} height={`${icon_size}em`} fill="none"
                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                    <path fill="currentColor"
                          d="M2 20.004 7.898 4h2.13L4.13 20.004H2ZM13.999 4l5.872 16.004h2.13L16.13 4h-2.131ZM11.002 8h2V6h-2v2ZM11.002 12.999h2v-3h-2v3ZM13.002 19h-2v-4h2v4Z"></path>
                </svg>
                <span>{Number(data.mileage).toLocaleString()} km</span>
            </div>

            {data.fuel_type &&
                <div className={`flex flex-col items-center gap-2`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width={`${icon_size}em`} height={`${icon_size}em`}
                         fill="none"
                         viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                        <path fill="currentColor" d="M10.997 9H6V5h4.997v4Z"></path>
                        <path fill="currentColor" fillRule="evenodd"
                              d="M16 3.042h3.408L22 5.579v13.422C22 20.206 21.201 22 19 22c-2.2 0-3-1.794-3-3v-6c0-.806-.55-.989-1.011-1H14v10H3V3.001l1-1h9l1 1V10h1c1.206 0 3 .799 3 3v6c.012.449.195 1 1 1 .806 0 .988-.55 1-1.011V6.421l-1.408-1.379H16l-1-1.041 1-.959ZM12 20H5V4.001h7V20Z"
                              clipRule="evenodd"></path>
                    </svg>
                    <span>{getFuelTypeLabel(data.fuel_type)}</span>
                </div>
            }

            <div className={`flex flex-col items-center gap-2`}>
                <svg xmlns="http://www.w3.org/2000/svg" width={`${icon_size}em`} height={`${icon_size}em`} fill="none"
                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                    <path fill="currentColor" fillRule="evenodd"
                          d="M21 4a2 2 0 0 0-4 0c0 .738.405 1.376 1 1.723v4.863l-.414.414H13V5.745A1.991 1.991 0 0 0 14.042 4a2 2 0 0 0-4 0c0 .721.385 1.348.958 1.7V11H6V5.723A1.994 1.994 0 0 0 5 2a1.994 1.994 0 0 0-1 3.723v12.554c-.595.347-1 .984-1 1.723a2 2 0 0 0 4 0c0-.739-.405-1.376-1-1.723V13h5v5.3a1.99 1.99 0 0 0-.958 1.7 2 2 0 0 0 4 0A1.99 1.99 0 0 0 13 18.255V13h5.414L20 11.414V5.723c.595-.347 1-.985 1-1.723Z"
                          clipRule="evenodd"></path>
                </svg>
                <span>{getGearBoxLabelType(data.gearbox)}</span>
            </div>

            <div className={`flex flex-col items-center gap-2`}>
                <svg xmlns="http://www.w3.org/2000/svg" width={`${icon_size}em`} height={`${icon_size}em`} fill="none"
                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                    <path fill="currentColor" fillRule="evenodd"
                          d="M16 18H12.83l-2-2H8v-6h8v8Zm5-9-1 1v2.042h-2V9l-1-1h-4V6h2.5l1-1-1-1h-7l-1 1 1 1H11v2H7L6 9v3H4v-2L3 9l-1 1v6l1 1 1-1v-2h2v3l1 1h3l2 2h5l1-1v-5h2v2l1 1 1-1v-6l-1-1Z"
                          clipRule="evenodd"></path>
                </svg>
                <span>{data.engine_capacity}</span>
            </div>

            <div className={`flex flex-col items-center gap-2`}>
                <svg xmlns="http://www.w3.org/2000/svg" width={`${icon_size}em`} height={`${icon_size}em`} fill="none"
                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                    <path fill="currentColor" fillRule="evenodd"
                          d="M17 7h4c.258.194.433.387.632.608.11.121.226.25.368.392v6l-1 1h-3v-1c0-.6-.4-1-1-1s-1 .4-1 1v1H8v-1c0-.6-.4-1-1-1s-1 .4-1 1v1H3l-1-1V7l3.8-5H16l1 5Zm2.8 6h.2V9h-4.7L15 7.3 14.3 4H6.7L4 7.6V13h.2c.4-1.2 1.5-2 2.8-2 1.3 0 2.4.8 2.8 2h4.4c.4-1.2 1.5-2 2.8-2 1.3 0 2.4.8 2.8 2ZM7 16c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.4-3-3-3Zm0 4c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.5 1-1 1Zm10-4c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.4-3-3-3Zm0 4c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.5 1-1 1Z"
                          clipRule="evenodd"></path>
                </svg>
                <span>{getBodyTypeLabel(data.body_type)}</span>
            </div>

            <div className={`flex flex-col items-center gap-2`}>
                <svg xmlns="http://www.w3.org/2000/svg" width={`${icon_size}em`} height={`${icon_size}em`} fill="none"
                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15" aria-hidden="true">
                    <g clipPath="url(#millage_svg__a)">
                        <path fill="currentColor" fillRule="evenodd"
                              d="M12 13c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1c0-.5-.4-1-1-1Zm5-4v1.4l-1.3 1.3-1 1c.2.4.3.8.3 1.3 0 1.7-1.3 3-3 3s-3-1.3-3-3 1.3-3 3-3c.5 0 .9.1 1.3.3l1-1L15.6 9H17Zm-5-3c-4.4 0-8 3.6-8 8 0 2.3.4 3.8 1.4 5h13.1c1-1.2 1.4-2.7 1.4-5 .1-4.4-3.5-8-7.9-8Zm0-2c5.5 0 10 4.5 10 10 0 2.2-.3 4.7-2.3 6.7l-.7.3H5l-.7-.3c-2-2-2.3-4.5-2.3-6.7C2 8.5 6.5 4 12 4Z"
                              clipRule="evenodd"></path>
                    </g>
                    <defs>
                        <clipPath id="millage_svg__a">
                            <path fill="#fff" d="M2 4h20v17H2z"></path>
                        </clipPath>
                    </defs>
                </svg>
                <span>{data.engine_power}</span>
            </div>
        </div>
    );
};

export default MainParams;