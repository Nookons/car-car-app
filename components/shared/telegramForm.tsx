'use client'

import React, {useCallback, useEffect, useState} from 'react';
import {Input} from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {Button} from "@/components/ui/button";
import {Power} from "lucide-react";

const TelegramForm = () => {
    const [tg, setTg] = useState<any>(null);

    const [brandValue, setBrandValue] = useState<string>('')
    const [fuelTypeValue, setFuelTypeValue] = useState<string>('')

    const onSendData = useCallback(() => {
        if (!tg) return;

        const data = {
            brand: brandValue,
            fuelType: fuelTypeValue
        };

        tg.sendData(JSON.stringify(data));
        tg.close();
    }, [brandValue, fuelTypeValue, tg]);


    useEffect(() => {
        if (!tg) return;

        tg.expand();
        tg.onEvent('sendMainData', onSendData)

        return () => {
            tg.offEvent('sendMainData', onSendData)
        }
    }, [tg, onSendData]);


    useEffect(() => {
        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
            setTg(window.Telegram.WebApp);
        }
    }, []);

    return (
        <div>
            {tg ? (
                <div>
                    <h2 className={`font-bold`}>{tg.initDataUnsafe?.user?.username || "Kolomiiets Dmytro"}</h2>
                    <p className={`text-xs text-neutral-500 mb-4`}>Please set up your search params for start...</p>

                    <div className={`flex flex-col gap-2 w-full`}>
                        <Select value={brandValue} onValueChange={(value) => setBrandValue(value)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a brand" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>Brand</SelectLabel>
                                    <SelectItem value="volvo">Volvo</SelectItem>
                                    <SelectItem value="volkswagen">Volkswagen</SelectItem>
                                    <SelectItem value="toyota">Toyota</SelectItem>
                                    <SelectItem value="suzuki">Suzuki</SelectItem>
                                    <SelectItem value="skoda">Skoda</SelectItem>
                                    <SelectItem value="seat">Seat</SelectItem>
                                    <SelectItem value="renault">Renault</SelectItem>
                                    <SelectItem value="porsche">Porsche</SelectItem>
                                    <SelectItem value="peugeot">Peugeot</SelectItem>
                                    <SelectItem value="opel">Opel</SelectItem>
                                    <SelectItem value="nissan">Nissan</SelectItem>
                                    <SelectItem value="mitsubishi">Mitsubishi</SelectItem>
                                    <SelectItem value="mercedes-benz">Mercedes-Benz</SelectItem>
                                    <SelectItem value="mazda">Mazda</SelectItem>
                                    <SelectItem value="mg">MG</SelectItem>
                                    <SelectItem value="lexus">Lexus</SelectItem>
                                    <SelectItem value="land rover">Land Rover</SelectItem>
                                    <SelectItem value="kia">Kia</SelectItem>
                                    <SelectItem value="jeep">Jeep</SelectItem>
                                    <SelectItem value="hyundai">Hyundai</SelectItem>
                                    <SelectItem value="honda">Honda</SelectItem>
                                    <SelectItem value="ford">Ford</SelectItem>
                                    <SelectItem value="dacia">Dacia</SelectItem>
                                    <SelectItem value="citroën">Citroën</SelectItem>
                                    <SelectItem value="chevrolet">Chevrolet</SelectItem>
                                    <SelectItem value="byd">BYD</SelectItem>
                                    <SelectItem value="bmw">BMW</SelectItem>
                                    <SelectItem value="audi">Audi</SelectItem>
                                    <SelectItem value="alfa romeo">Alfa Romeo</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>

                        <Select value={fuelTypeValue} onValueChange={(value) => setFuelTypeValue(value)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a Fuel Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>Brand</SelectLabel>
                                    <SelectItem value="benzyna">Benzyna</SelectItem>
                                    <SelectItem value="benzyna-lpg">Benzyna+LPG</SelectItem>
                                    <SelectItem value="diesel">Diesel</SelectItem>
                                    <SelectItem value="elektryczny">Elektryczny</SelectItem>
                                    <SelectItem value="hybryda">Hybryda</SelectItem>
                                    <SelectItem value="hybryda-plug-in">Hybryda Plug-in</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>

                        <Button
                            id="sendMainData"
                            className="font-bold flex items-center gap-2"
                            onClick={onSendData}
                        >
                            <Power />
                            <span>Start</span>
                        </Button>
                    </div>
                </div>
            ) : (
                <p>Loading Telegram data...</p>
            )}
        </div>
    );
};

export default TelegramForm;
