'use client';

import React, {useCallback, useEffect, useState} from 'react';
import {Button} from "@/components/ui/button";
import {Power} from "lucide-react";
import BrandSelect from './Brand/BrandSelect';
import ModelSelect from "@/components/shared/Model/ModelSelect";
import PriceAccordion from "@/components/shared/Price/PriceAccordion";
import YearsAccordion from "@/components/shared/Years/YearsAccordion";

const TelegramForm = () => {
    const [tg, setTg] = useState<any>(null);

    const [userName, setUserName] = useState<string>('')


    const [brandValue, setBrandValue] = useState<string>('');

    const [model, setModel] = useState<string>('')

    const [minPrice, setMinPrice] = useState<number>(0);
    const [maxPrice, setMaxPrice] = useState<number>(0);

    const [minYear, setMinYear] = useState<string>('');
    const [maxYear, setMaxYear] = useState<string>('');

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
            max_year: maxYear
        };

        tg.sendData(JSON.stringify(data));
    }, [brandValue, model, minPrice, maxPrice, tg]);


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
                    <h2 className="font-bold">{userName}</h2>
                    <p className="text-xs text-neutral-500 mb-4">Please set up your search params for start...</p>
                    <p className="text-xs font-semibold text-primary/75 mb-4">
                        Here you can pick only cars what we have on our data base, so if you can't find out car what you
                        interesting. Our team work on extend our base.
                        <br/>
                        <br/>
                        Thank you for understanding!
                    </p>

                    <div className="flex flex-col gap-2 w-full">
                        <BrandSelect value={brandValue} onChange={setBrandValue}/>

                        {brandValue && (<ModelSelect value={model} onChange={setModel} search_value={brandValue}/>)}


                        <PriceAccordion
                            brandValue={brandValue}
                            model={model}
                            minPrice={minPrice}
                            maxPrice={maxPrice}
                            setMinPrice={setMinPrice}
                            setMaxPrice={setMaxPrice}
                        />

                        <YearsAccordion
                            brand_value={brandValue}
                            model_value={model}
                            minYear={minYear}
                            maxYear={maxYear}
                            setMinYear={setMinYear}
                            setMaxYear={setMaxYear}
                        />



                        <Button
                            id="sendMainData"
                            className="font-bold flex items-center gap-2"
                            onClick={onSendData}
                        >
                            <Power/>
                            <span>Start</span>
                        </Button>

                        <p className="text-xs font-semibold text-neutral-500 mb-4">
                            Also we will be add new features in search params in next updates, so stay tuned!
                        </p>
                    </div>
                </div>
            ) : (
                <p>Loading Telegram data...</p>
            )}
        </div>
    );
};

export default TelegramForm;
