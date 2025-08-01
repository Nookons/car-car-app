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
import {useTelegramFormStore} from "@/store/telegram-form/TelegramForm";
import RangeFromUser from "@/components/shared/telegram-form/RangeFromUser/RangeFromUser";


const TelegramForm = () => {
    const [tg, setTg] = useState<any>(null);
    const [userName, setUserName] = useState<string>('')

    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [locationString, setLocationString] = useState<string>('');

    const data = useTelegramFormStore(state => state.data)

    const [isCondition, setIsCondition] = useState<boolean>(true)


    const onSendData = useCallback(() => {
        if (!tg) return;

        const telegram_obj = {
            ...data,
            lat: location?.lat || 0,
            lng: location?.lng || 0,
            locationString: locationString,
        };

        tg.sendData(JSON.stringify(telegram_obj));
    }, [data, location, locationString, tg]);


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
            <div>
                <div className="flex flex-col gap-2 w-full">
                    <BrandSelect/>
                    {data.brands.length > 0 && (<ModelSelect/>)}


                    <div className={`my-4 flex flex-col gap-2 w-full`}>
                        <PriceSelect
                        />

                        <YearsSelect
                        />
                    </div>

                    <RangeFromUser />

                    <div>
                        <MilageSelect
                        />
                    </div>

                    <div>
                        <SellerSelect
                        />

                        <PlatformSelect
                        />

                        <ConditionSelect
                        />
                    </div>

                    <GetUserLocation
                        location={location}
                        setLocation={setLocation}
                        locationString={locationString}
                        setLocationString={setLocationString}
                    />

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
        </div>
    );
};

export default TelegramForm;
