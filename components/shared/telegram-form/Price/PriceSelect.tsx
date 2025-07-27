'use client';

import React, {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeftRight, LoaderCircle, Smile, Truck} from "lucide-react";
import {getPrices} from "@/features/getPrices";
import {IPriceResponse} from "@/types/Price";
import {Input} from "@/components/ui/input";
import {useTelegramFormStore} from "@/store/telegram-form/TelegramForm";



const PriceSelect = () => {
    const telegramData = useTelegramFormStore(state => state.data)
    const setMinPrice = useTelegramFormStore(state => state.setMinPrice)
    const setMaxPrice = useTelegramFormStore(state => state.setMaxPrice)

    const {data: IPriceResponse = {min_price: 0, max_price: 0}, isLoading, isError} = useQuery<IPriceResponse>({
        queryKey: ['prices'],
        queryFn: () => getPrices(),
        staleTime: 5 * 60 * 1000,
    });

    return (
        <div>
            <article className={`my-2 text-neutral-500 text-xs`}>Price Ranges:</article>
            <div className="w-full grid grid-cols-[1fr_20px_1fr] items-center gap-4">
                <div className="relative">
                    <Input
                        type="number"
                        value={telegramData.minPrice === 0 ? '' : telegramData.minPrice}
                        onChange={(event) => setMinPrice(Number(event.target.value))}
                        min={IPriceResponse.min_price}
                        max={IPriceResponse.max_price}
                        className="pr-10"
                        placeholder={isLoading ? 'Loading...' : `${IPriceResponse.min_price.toLocaleString()}`}
                    />
                    {isLoading ? (
                            <div className="absolute top-1/2 right-3 -translate-y-1/2">
                                <LoaderCircle className="animate-spin text-gray-500"/>
                            </div>
                        )
                        : (
                            <div className="absolute top-1/2 right-3 -translate-y-1/2">
                                zł
                            </div>
                        )
                    }
                    {telegramData.minPrice > 0 && (
                        <p className="text-neutral-500 text-x absolute top-13 right-3 -translate-y-1/2">
                            {Math.round(telegramData.minPrice / 4).toLocaleString()} $
                        </p>
                    )}
                </div>
                <div>
                    <ArrowLeftRight size={14} />
                </div>
                <div className="relative">
                    <Input
                        value={telegramData.maxPrice === 0 ? '' : telegramData.maxPrice}
                        onChange={(event) => setMaxPrice(Number(event.target.value))}
                        type="number"
                        min={telegramData.minPrice}
                        maxLength={7}
                        max={IPriceResponse.max_price}
                        className={`pr-10`}
                        placeholder={
                            isLoading
                                ? 'Loading...'
                                : `${IPriceResponse.max_price.toLocaleString()}`
                        }
                    />
                    {isLoading ? (
                            <div className="absolute top-1/2 right-3 -translate-y-1/2">
                                <LoaderCircle className="animate-spin text-gray-500"/>
                            </div>
                        )
                        : (
                            <div className="absolute top-1/2 right-3 -translate-y-1/2">
                                zł
                            </div>
                        )
                    }
                    {telegramData.maxPrice > 0 && (
                        <p className="text-neutral-500 text-x absolute top-13 right-3 -translate-y-1/2">
                            {Math.round(telegramData.maxPrice / 4).toLocaleString()} $
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PriceSelect;
