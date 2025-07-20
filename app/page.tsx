import { ICarAdd } from "@/types/Car";
import Image from "next/image";
import dayjs from "dayjs";
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {ModeToggle} from "@/components/ModeToggle/ModeToggle";
import React from "react";
import relativeTime from 'dayjs/plugin/relativeTime'
import duration from 'dayjs/plugin/duration'

dayjs.extend(relativeTime)
dayjs.extend(duration)



async function getCars() {
    const res = await fetch('https://car-car-app.vercel.app/api/all-cars', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch cars');
    return res.json();
}

export default async function Home() {
    const data: ICarAdd[] = await getCars();

    return (
        <div className={`p-4`}>
            <div className={`flex items-center justify-between gap-4 w-full`}>
                <h1 className={`text-xs text-neutral-500`}>Welcome to <span className={`text-primary text-xl font-bold`}>CarCar</span></h1>
                <ModeToggle />
            </div>
            <div className="p-6 max-w-[1400px] m-auto grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 gap-6">
                {data.slice(0, 10).map((car) => {
                    if (car.image_url === 'unknown') return null;

                    const postedDate = dayjs(car.posted_time)
                    const now = dayjs()
                    const diffInHours = now.diff(postedDate, 'hour')

                    return (
                        <Card key={car.id} className="shadow-lg grid grid-cols-[450px_1fr] cursor-pointer gap-1 p-0 transition hover:bg-secondary/50 rounded-lg">
                            <CardHeader className="p-0 rounded-l-lg overflow-hidden h-68 relative">
                                <Image
                                    src={car.image_url}
                                    alt={car.title}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 33vw"
                                    style={{ objectFit: 'cover' }}
                                    priority
                                />
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className={`flex justify-between items-center gap-4 py-4`}>
                                    <CardTitle className="text-lg font-semibold line-clamp-1">{car.title}</CardTitle>
                                    <p className="text-xl">
                                        <span className="font-medium">{car.price.toLocaleString()} PLN</span>
                                    </p>
                                </div>

                                <div className={`flex flex-col h-fit gap-4 justify-between`}>
                                    <div className={`flex flex-wrap gap-8`}>
                                        <div className={`flex items-center gap-2`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="1.5em" height="1.5em" fill="none"
                                                 viewBox="0 0 24 24" role="img" className="ooa-c3wb15 text-primary">
                                                <path fill="currentColor"
                                                      d="M2 20.004 7.898 4h2.13L4.13 20.004H2ZM13.999 4l5.872 16.004h2.13L16.13 4h-2.131ZM11.002 8h2V6h-2v2ZM11.002 12.999h2v-3h-2v3ZM13.002 19h-2v-4h2v4Z"></path>
                                            </svg>
                                            <span>{Number(car.mileage).toLocaleString()} km</span>
                                        </div>

                                        <div className={`flex items-center gap-2`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="1.5em" height="1.5em" fill="none"
                                                 viewBox="0 0 24 24" role="img" className="ooa-c3wb15 text-primary">
                                                <path fill="currentColor" fill-rule="evenodd"
                                                      d="M21 4a2 2 0 0 0-4 0c0 .738.405 1.376 1 1.723v4.863l-.414.414H13V5.745A1.991 1.991 0 0 0 14.042 4a2 2 0 0 0-4 0c0 .721.385 1.348.958 1.7V11H6V5.723A1.994 1.994 0 0 0 5 2a1.994 1.994 0 0 0-1 3.723v12.554c-.595.347-1 .984-1 1.723a2 2 0 0 0 4 0c0-.739-.405-1.376-1-1.723V13h5v5.3a1.99 1.99 0 0 0-.958 1.7 2 2 0 0 0 4 0A1.99 1.99 0 0 0 13 18.255V13h5.414L20 11.414V5.723c.595-.347 1-.985 1-1.723Z"
                                                      clip-rule="evenodd"></path>
                                            </svg>
                                            <span>{car.gearbox}</span>
                                        </div>

                                        <div className={`flex items-center gap-2`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="1.5em" height="1.5em" fill="none"
                                                 viewBox="0 0 24 24" role="img" className="ooa-c3wb15 text-primary">
                                                <path fill="currentColor" d="M10.997 9H6V5h4.997v4Z"></path>
                                                <path fill="currentColor" fill-rule="evenodd"
                                                      d="M16 3.042h3.408L22 5.579v13.422C22 20.206 21.201 22 19 22c-2.2 0-3-1.794-3-3v-6c0-.806-.55-.989-1.011-1H14v10H3V3.001l1-1h9l1 1V10h1c1.206 0 3 .799 3 3v6c.012.449.195 1 1 1 .806 0 .988-.55 1-1.011V6.421l-1.408-1.379H16l-1-1.041 1-.959ZM12 20H5V4.001h7V20Z"
                                                      clip-rule="evenodd"></path>
                                            </svg>
                                            <span>{car.fuel_type}</span>
                                        </div>

                                        <div className={`flex items-center gap-2`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="1.5em" height="1.5em" fill="none"
                                                 viewBox="0 0 24 24" className="ooa-51p4fw text-primary">
                                                <path fill="currentColor"
                                                      d="M6.004 13.5a1.5 1.5 0 1 1 3.001.001 1.5 1.5 0 0 1-3.001-.001Z"></path>
                                                <path fill="currentColor" fill-rule="evenodd"
                                                      d="M16.013 3V2h2.002v1h2.984L22 4v17l-1 1H3l-1-1V4l1-1h3.003V2h2.003v1h8.007Zm2.002 2v1l-1.001 1-1.001-1V5H8.006v1L7.005 7 6.003 6V5H4.002v3h15.996V5h-1.983Zm1.983 15H4.002V10h15.996v10Z"
                                                      clip-rule="evenodd"></path>
                                            </svg>
                                            <span>{car.production_year}</span>
                                        </div>
                                    </div>



                                    {/*<svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" fill="none"
                                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15">
                                    <path fill="currentColor"
                                          d="M2 20.004 7.898 4h2.13L4.13 20.004H2ZM13.999 4l5.872 16.004h2.13L16.13 4h-2.131ZM11.002 8h2V6h-2v2ZM11.002 12.999h2v-3h-2v3ZM13.002 19h-2v-4h2v4Z"></path>
                                </svg>
                                <svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" fill="none"
                                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15">
                                    <path fill="currentColor" d="M10.997 9H6V5h4.997v4Z"></path>
                                    <path fill="currentColor" fill-rule="evenodd"
                                          d="M16 3.042h3.408L22 5.579v13.422C22 20.206 21.201 22 19 22c-2.2 0-3-1.794-3-3v-6c0-.806-.55-.989-1.011-1H14v10H3V3.001l1-1h9l1 1V10h1c1.206 0 3 .799 3 3v6c.012.449.195 1 1 1 .806 0 .988-.55 1-1.011V6.421l-1.408-1.379H16l-1-1.041 1-.959ZM12 20H5V4.001h7V20Z"
                                          clip-rule="evenodd"></path>
                                </svg>
                                <svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" fill="none"
                                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15">
                                    <path fill="currentColor" fill-rule="evenodd"
                                          d="M21 4a2 2 0 0 0-4 0c0 .738.405 1.376 1 1.723v4.863l-.414.414H13V5.745A1.991 1.991 0 0 0 14.042 4a2 2 0 0 0-4 0c0 .721.385 1.348.958 1.7V11H6V5.723A1.994 1.994 0 0 0 5 2a1.994 1.994 0 0 0-1 3.723v12.554c-.595.347-1 .984-1 1.723a2 2 0 0 0 4 0c0-.739-.405-1.376-1-1.723V13h5v5.3a1.99 1.99 0 0 0-.958 1.7 2 2 0 0 0 4 0A1.99 1.99 0 0 0 13 18.255V13h5.414L20 11.414V5.723c.595-.347 1-.985 1-1.723Z"
                                          clip-rule="evenodd"></path>
                                </svg>
                                <svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" fill="none"
                                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15">
                                    <path fill="currentColor" fill-rule="evenodd"
                                          d="M17 7h4c.258.194.433.387.632.608.11.121.226.25.368.392v6l-1 1h-3v-1c0-.6-.4-1-1-1s-1 .4-1 1v1H8v-1c0-.6-.4-1-1-1s-1 .4-1 1v1H3l-1-1V7l3.8-5H16l1 5Zm2.8 6h.2V9h-4.7L15 7.3 14.3 4H6.7L4 7.6V13h.2c.4-1.2 1.5-2 2.8-2 1.3 0 2.4.8 2.8 2h4.4c.4-1.2 1.5-2 2.8-2 1.3 0 2.4.8 2.8 2ZM7 16c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.4-3-3-3Zm0 4c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.5 1-1 1Zm10-4c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.4-3-3-3Zm0 4c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.5 1-1 1Z"
                                          clip-rule="evenodd"></path>
                                </svg>
                                <svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" fill="none"
                                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15">
                                    <path fill="currentColor" fill-rule="evenodd"
                                          d="M16 18H12.83l-2-2H8v-6h8v8Zm5-9-1 1v2.042h-2V9l-1-1h-4V6h2.5l1-1-1-1h-7l-1 1 1 1H11v2H7L6 9v3H4v-2L3 9l-1 1v6l1 1 1-1v-2h2v3l1 1h3l2 2h5l1-1v-5h2v2l1 1 1-1v-6l-1-1Z"
                                          clip-rule="evenodd"></path>
                                </svg>
                                <svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" fill="none"
                                     viewBox="0 0 24 24" role="img" className="ooa-c3wb15">
                                    <g clip-path="url(#millage_svg__a)">
                                        <path fill="currentColor" fill-rule="evenodd"
                                              d="M12 13c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1c0-.5-.4-1-1-1Zm5-4v1.4l-1.3 1.3-1 1c.2.4.3.8.3 1.3 0 1.7-1.3 3-3 3s-3-1.3-3-3 1.3-3 3-3c.5 0 .9.1 1.3.3l1-1L15.6 9H17Zm-5-3c-4.4 0-8 3.6-8 8 0 2.3.4 3.8 1.4 5h13.1c1-1.2 1.4-2.7 1.4-5 .1-4.4-3.5-8-7.9-8Zm0-2c5.5 0 10 4.5 10 10 0 2.2-.3 4.7-2.3 6.7l-.7.3H5l-.7-.3c-2-2-2.3-4.5-2.3-6.7C2 8.5 6.5 4 12 4Z"
                                              clip-rule="evenodd"></path>
                                    </g>
                                    <defs>
                                        <clipPath id="millage_svg__a">
                                            <path fill="#fff" d="M2 4h20v17H2z"></path>
                                        </clipPath>
                                    </defs>
                                </svg>*/}
                                    <div className={`space-y-2`}>
                                        <p className="text-sm text-muted-foreground">{car.brand} • {car.model} • {car.color}</p>
                                        <p className="text-sm text-muted-foreground">{car.city}</p>

                                        <p className="text-sm text-muted-foreground">
                                            {diffInHours < 24
                                                ? postedDate.fromNow()
                                                : postedDate.format('dddd, MMMM DD [at] HH:mm')}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
