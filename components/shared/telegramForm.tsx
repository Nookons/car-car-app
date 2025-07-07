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
            lng: location?.lat || 0,
            locationString: locationString,
        };

        tg.sendData(JSON.stringify(data));
    }, [brandValue, model, minPrice, maxPrice, minYear, maxYear, location, locationString, tg]);


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


                        <div className={`my-4`}>
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
