'use client';

import React, {useCallback, useEffect, useState} from 'react';
import {Button} from "@/components/ui/button";
import {Power} from "lucide-react";
import GetUserLocation from './UserLocation/getUserLocation';
import BrandSelect from './Brand/BrandSelect';
import ModelSelect from './Model/ModelSelect';
import PriceSelect from './Price/PriceSelect';
import YearsSelect from './Years/YearsSelect';
import MileageSelect from "@/components/shared/telegram-form/Mileage/MileageSelect";
import SellerSelect from './Seller/SellerSelect';
import PlatformSelect from './Platform/PlatformSelect';
import ConditionSelect from './Condition/ConditionSelect';
import ConditionCheckBox from './Conditions/ConditionCheckBox';
import {useTelegramFormStore} from "@/store/telegram-form/TelegramForm";
import RangeFromUser from "@/components/shared/telegram-form/RangeFromUser/RangeFromUser";
import {t} from "i18next";

const TelegramForm = () => {
    const [tg, setTg] = useState<any>(null);

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
            const tg: any = window.Telegram.WebApp;
            setTg(tg); // step 1: set tg
        }
    }, []); // runs once

    useEffect(() => {
        if (typeof window === 'undefined' || !window.Telegram?.WebApp) return;

        const tg: any = window.Telegram.WebApp;
        setTg(tg);

        tg.onEvent('sendMainData', onSendData);

        if (Number(tg.version) > 6) {
            tg.requestFullscreen();
        } else {
            console.log('Fullscreen is not available for this version of Telegram Web App');
        }

        return () => {
            tg.offEvent('sendMainData', onSendData);
        };
    }, [onSendData]);

    return (
        <div>
            <div>
                <div className="flex flex-col gap-2 w-full">
                    <div className={`flex flex-col gap-4`}>
                        <BrandSelect/>
                        {data.brands.length > 0 && (<ModelSelect/>)}
                        <MileageSelect/>
                        <PriceSelect
                        />
                        <YearsSelect
                        />
                        <div className={`mt-4`}>
                            <RangeFromUser/>
                        </div>
                        <SellerSelect
                        />
                        <hr/>
                        <PlatformSelect
                        />
                        <hr/>
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
                            className="font-bold text-foreground w-full flex items-center gap-2"
                            onClick={onSendData}
                        >
                            <Power/>
                            <span>{t(`telegram_form.start_button`)}</span>
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
