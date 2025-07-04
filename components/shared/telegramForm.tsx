'use client';

import React, {useCallback, useEffect, useState} from 'react';
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
import BrandSelect from './Brand/BrandSelect';
import ModelSelect from "@/components/shared/Model/ModelSelect";
import PriceSelect from "@/components/shared/Price/PriceSelect";
import {max} from "@floating-ui/utils";

const TelegramForm = () => {
    const [tg, setTg] = useState<any>(null);


    const [brandValue, setBrandValue] = useState<string>('');

    const [model, setModel] = useState<string>('')

    const [minPrice, setMinPrice] = useState<number>(0);
    const [maxPrice, setMaxPrice] = useState<number>(0);



    const onSendData = useCallback(() => {
        if (!tg) return;

        const data = {
            brand: brandValue,
            model: model,
            min_price: minPrice,
            max_price: maxPrice
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
                    <h2 className="font-bold">{tg.initDataUnsafe?.user?.username || "Kolomiiets Dmytro"}</h2>
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

                        {model && (
                            <PriceSelect
                                minPrice={minPrice}
                                maxPrice={maxPrice}
                                minChange={setMinPrice}
                                maxChange={setMaxPrice}
                                search_value={model}
                                type={'model'}
                            />
                        )}


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
