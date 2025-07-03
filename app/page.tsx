import { ICarAdd } from "@/types/Car";
import Image from "next/image";
import dayjs from "dayjs";
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {ModeToggle} from "@/components/ModeToggle/ModeToggle";
import Script from 'next/script'
import TelegramForm from "@/components/shared/telegramForm";


async function getCars() {
    const res = await fetch('https://car-car-app.vercel.app/api/cars', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch cars');
    return res.json();
}

export default async function Home() {
    const data: ICarAdd[] = await getCars();

    return (
        <div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-4 gap-6">
                <div className={`flex flex-col gap-4 w-full`}>
                    <ModeToggle />
                    <TelegramForm />
                </div>
                {data.map((car) => {
                    if (car.image_url === 'unknown') return null;

                    return (
                        <Card key={car.id} className="shadow-lg hover:shadow-xl transition-shadow rounded-lg">
                            <CardHeader className="p-0 rounded-t-lg overflow-hidden h-48 relative">
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
                                <CardTitle className="text-lg font-semibold line-clamp-1">{car.title}</CardTitle>
                                <p className="text-sm text-muted-foreground">{car.brand} • {car.model} • {car.color}</p>
                                <p className="text-sm">
                                    Price: <span className="font-medium">{car.price.toLocaleString()} PLN</span>
                                </p>
                                <p className="text-sm text-muted-foreground">City: {car.city}</p>
                                <p className="text-sm text-muted-foreground">
                                    Posted: {dayjs(car.posted_time).format('YYYY-MM-DD HH:mm')}
                                </p>
                            </CardContent>
                            <CardFooter>
                                <Button asChild size="sm" variant="outline" className="w-full">
                                    <a href={car.url} target="_blank" rel="noopener noreferrer">
                                        View Listing
                                    </a>
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
            <Script
                src="https://telegram.org/js/telegram-web-app.js?57"
                strategy="beforeInteractive"
            />
        </div>
    );
}
