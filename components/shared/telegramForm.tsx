'use client';

import React, {useCallback, useEffect, useState} from 'react';
import {Button} from "@/components/ui/button";
import {Power} from "lucide-react";
import BrandSelect from './Brand/BrandSelect';
import ModelSelect from "@/components/shared/Model/ModelSelect";
import ConditionCheckBox from "@/components/shared/Conditions/ConditionCheckBox";
import PriceSelect from "@/components/shared/Price/PriceSelect";
import YearsSelect from "@/components/shared/Years/YearsSelect";
import GetUserLocation from "@/components/shared/UserLocation/getUserLocation";
import { Slider } from "radix-ui";

const TelegramForm = () => {
    const [tg, setTg] = useState<any>(null);

    const [userName, setUserName] = useState<string>('')

    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [locationString, setLocationString] = useState<string>('');

    const [brandValue, setBrandValue] = useState<string>('');

    const [model, setModel] = useState<string>('')

    const [minPrice, setMinPrice] = useState<number>(0);
    const [maxPrice, setMaxPrice] = useState<number>(0);

    const [minYear, setMinYear] = useState<string>('');
    const [maxYear, setMaxYear] = useState<string>('');

    const [rangeValue, setRangeValue] = useState<number[]>([50]);

    const [minMileage, setMinMileage] = useState<number | null>(null);
    const [maxMileage, setMaxMileage] = useState<number | null>(null);


    const [isCondition, setIsCondition] = useState<boolean>(true)

    useEffect(() => {
        setMinPrice(0)
        setMaxPrice(0)
        setMinYear('')
        setMaxYear('')
    }, [brandValue, model]);


    const onSendData = useCallback(() => {
        if (!tg) return;

        const data = {
            brand: brandValue,
            model: model,
            min_price: minPrice,
            max_price: maxPrice,
            min_year: minYear,
            max_year: maxYear,
            lat: location?.lat || 0,
            lng: location?.lng || 0,
            locationString: locationString,
            range: rangeValue[0],
        };

        tg.sendData(JSON.stringify(data));
    }, [brandValue, model, minPrice, maxPrice, minYear, maxYear, location, locationString, rangeValue, tg]);


    useEffect(() => {
        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
            setTg(window.Telegram.WebApp);
        }
    }, []);

    useEffect(() => {
        if (!tg) return;

        setUserName(tg.initDataUnsafe?.user?.username)

        tg.expand();
        tg.onEvent('sendMainData', onSendData);

        return () => {
            tg.offEvent('sendMainData', onSendData);
        };
    }, [tg, onSendData]);

    return (
        <div>
            {tg ? (
                <div>
                    <div className="flex flex-col gap-2 w-full">

                        <GetUserLocation
                            location={location}
                            setLocation={setLocation}
                            locationString={locationString}
                            setLocationString={setLocationString}
                        />

                        <BrandSelect value={brandValue} onChange={setBrandValue}/>
                        {brandValue && (<ModelSelect value={model} onChange={setModel} search_value={brandValue}/>)}


                        <div className={`my-4 flex flex-col gap-2 w-full`}>
                            <PriceSelect
                                brand_value={brandValue}
                                model_value={model}
                                minPrice={minPrice}
                                maxPrice={maxPrice}
                                minChange={setMinPrice}
                                maxChange={setMaxPrice}
                            />

                            <YearsSelect
                                brand_value={brandValue}
                                model_value={model}
                                minYear={minYear}
                                maxYear={maxYear}
                                minChange={setMinYear}
                                maxChange={setMaxYear}
                            />
                        </div>

                        <div className={`py-6 relative`}>
                            <article className={`text-neutral-500 text-x pb-2`}>Range to your new car</article>
                            <Slider.Root
                                className="relative bg-neutral-500 rounded-2xl flex h-1 w-full touch-none select-none items-center"
                                defaultValue={[50]}
                                max={250}
                                value={rangeValue}
                                onValueChange={setRangeValue}
                                step={10}
                            >
                            <Slider.Track className="relative h-[4px] grow rounded-full bg-blackA7">
                                    <Slider.Range className="absolute h-full rounded-full bg-primary" />
                                </Slider.Track>

                                <Slider.Thumb
                                    className="block size-3 rounded-[10px] bg-white shadow-[0_2px_10px] shadow-blackA4 hover:bg-violet3 focus:shadow-[0_0_0_5px] focus:shadow-blackA5 focus:outline-none"
                                    aria-label="Volume"
                                />
                                <p
                                    className={`absolute text-xs right-0 rounded p-1 font-bold transition top-4 ${rangeValue[0] >= 100 && 'bg-primary/25'}`}
                                >
                                    {rangeValue[0]} km
                                </p>
                            </Slider.Root>
                        </div>


                        <div className={`my-4`}>
                            <Button
                                disabled={!isCondition}
                                id="sendMainData"
                                className="font-bold w-full flex items-center gap-2"
                                onClick={onSendData}
                            >
                                <Power/>
                                <span>Start</span>
                            </Button>

                            <div className={`mt-4`}>
                                <ConditionCheckBox
                                    value={isCondition}
                                    onChange={setIsCondition}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <p>Loading Telegram data...</p>
            )}
        </div>
    );
};

export default TelegramForm;
