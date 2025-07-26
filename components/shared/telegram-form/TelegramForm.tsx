'use client';

import React, {useCallback, useEffect, useState} from 'react';
import {Button} from "@/components/ui/button";
import {CircleMinus, CirclePlus, Power} from "lucide-react";
import GetUserLocation from './UserLocation/getUserLocation';
import BrandSelect from './Brand/BrandSelect';
import ModelSelect from './Model/ModelSelect';
import PriceSelect from './Price/PriceSelect';
import YearsSelect from './Years/YearsSelect';
import MilageSelect from "@/components/shared/telegram-form/Milage/MilageSelect";
import SellerSelect from './Seller/SellerSelect';
import PlatformSelect from './Platform/PlatformSelect';
import ConditionSelect from './Condition/ConditionSelect';
import ConditionCheckBox from './Conditions/ConditionCheckBox';
import {Skeleton, Slider} from "@/components/ComponentsProvider";


const TelegramForm = () => {
    const [tg, setTg] = useState<any>(null);
    const [userName, setUserName] = useState<string>('')

    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [locationString, setLocationString] = useState<string>('');


    const [brandValue, setBrandValue] = useState<string[]>([]);
    const [model, setModel] = useState<string[]>([])

    const [minPrice, setMinPrice] = useState<number>(0);
    const [maxPrice, setMaxPrice] = useState<number>(0);

    const [minYear, setMinYear] = useState<string>('');
    const [maxYear, setMaxYear] = useState<string>('');

    const [rangeValue, setRangeValue] = useState<number[]>([50]);

    const [maxMileage, setMaxMileage] = useState<number>(0);

    const [sellerTypes, setSellerTypes] = useState<string[]>([ 'private' ]);
    const [platformTypes, setPlatformTypes] = useState<string[]>([ 'oto_moto' ]);
    const [conditionTypes, setConditionTypes] = useState<string[]>([ 'used', 'new' ]);


    const [isCondition, setIsCondition] = useState<boolean>(true)


    const setBrandTemp = (value: string[]) => {
        setBrandValue([value.pop() || ""]);
    }

    useEffect(() => {
        setMinPrice(0)
        setMaxPrice(0)
        setMinYear('')
        setMaxYear('')
    }, [brandValue, model]);

    useEffect(() => {
        console.log(brandValue);
    }, [brandValue])


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
            maxMileage: maxMileage,
            sellerTypes: sellerTypes,
            platformTypes: platformTypes,
            conditionTypes: conditionTypes
        };

        tg.sendData(JSON.stringify(data));
    }, [brandValue, model, minPrice, maxPrice, minYear, maxYear, location, locationString, rangeValue, maxMileage, sellerTypes, platformTypes, conditionTypes, tg]);


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

                        <BrandSelect value={brandValue} onChange={setBrandTemp}/>
                        {/*{brandValue.length > 0 && (<ModelSelect value={model} onChange={setModel} search_value={brandValue}/>)}*/}


                        <div className={`my-4 flex flex-col gap-2 w-full`}>
                            <PriceSelect
                                minPrice={minPrice}
                                maxPrice={maxPrice}
                                minChange={setMinPrice}
                                maxChange={setMaxPrice}
                            />

                            <YearsSelect
                                minYear={minYear}
                                maxYear={maxYear}
                                minChange={setMinYear}
                                maxChange={setMaxYear}
                            />
                        </div>

                        <div className={`py-6 relative`}>
                            <article className={`text-neutral-500 text-x pb-4 grid grid-cols-2 items-center`}>
                                Range to your new car
                                <div className={`flex justify-end gap-8`}>
                                    <CirclePlus onClick={() => setRangeValue(prev => [prev[0] + 25])}
                                                className={`text-foreground`} size={20}/>
                                    <CircleMinus onClick={() => setRangeValue(prev => [prev[0] - 25])}
                                                 className={`text-foreground`} size={20}/>
                                </div>
                            </article>
                            <Slider
                                value={rangeValue}
                                max={250}
                                step={25}
                                onValueChange={setRangeValue}
                                className="shadow-lg rounded-lg"
                            />
                            <div className={`w-full py-2`}>
                                {rangeValue[0]} km
                            </div>
                        </div>

                        <div>
                            <MilageSelect
                                maxMilage={maxMileage}
                                setMaxMilage={setMaxMileage}
                            />
                        </div>

                        <div>
                            <SellerSelect
                                sellerTypes={sellerTypes}
                                change={setSellerTypes}
                            />

                            <PlatformSelect
                                platformTypes={platformTypes}
                                change={setPlatformTypes}
                            />

                            <ConditionSelect
                                conditionTypes={conditionTypes}
                                change={setConditionTypes}
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
                <div className="flex flex-col space-y-3">
                    <Skeleton className="h-[50px] rounded" />
                    <Skeleton className="h-[75px] rounded" />
                    <Skeleton className="h-[125px] rounded" />
                    <div className="space-y-2">
                        <Skeleton className="h-4" />
                        <Skeleton className="h-4" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default TelegramForm;
