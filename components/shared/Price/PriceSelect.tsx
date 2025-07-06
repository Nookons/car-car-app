'use client';

import React, {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {LoaderCircle, Smile, Truck} from "lucide-react";
import {getPrices} from "@/features/getPrices";
import {IPriceResponse} from "@/types/Price";
import {Input} from "@/components/ui/input";

interface Props {
    minPrice: number;
    maxPrice: number;

    minChange: (value: number) => void;
    maxChange: (value: number) => void;

    model_value: string;
    brand_value: string;
}

const PriceSelect: React.FC<Props> = ({minPrice, maxPrice, minChange, maxChange, model_value, brand_value}) => {
    const {
        data: IPriceResponse = {brand: '', min_price: 0, max_price: 0},
        isLoading,
        isError
    } = useQuery<IPriceResponse>({
        queryKey: ['brands', model_value, brand_value],
        queryFn: () => getPrices(model_value, brand_value),
        staleTime: 5 * 60 * 1000,
    });

    return (
        <div className="w-full grid grid-cols-2 gap-4">
            <div className="relative">
                <Input
                    type="number"
                    value={minPrice === 0 ? '' : minPrice}
                    onChange={(event) => minChange(Number(event.target.value))}
                    min={IPriceResponse.min_price}
                    max={IPriceResponse.max_price}
                    className="pr-15"
                    placeholder={isLoading ? 'Loading...' : `${IPriceResponse.min_price.toLocaleString()}`}
                />
                {isLoading ? (
                        <div className="absolute top-1/2 right-3 -translate-y-1/2">
                            <LoaderCircle className="animate-spin text-gray-500"/>
                        </div>
                    )
                    : (
                        <div className="absolute top-1/2 right-3 -translate-y-1/2">
                            PLN
                        </div>
                    )
                }
                {minPrice > 0 && (
                    <p className="text-neutral-500 text-x absolute top-13 right-3 -translate-y-1/2">
                        {Math.round(minPrice / 4).toLocaleString()} $
                    </p>
                )}
            </div>
            <div className="relative">
                <Input
                    value={maxPrice === 0 ? '' : maxPrice}
                    onChange={(event) => maxChange(Number(event.target.value))}
                    type="number"
                    min={minPrice}
                    maxLength={7}
                    max={IPriceResponse.max_price}
                    className={`pr-15`}
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
                            PLN
                        </div>
                    )
                }
                {maxPrice > 0 && (
                    <p className="text-neutral-500 text-x absolute top-13 right-3 -translate-y-1/2">
                        {Math.round(maxPrice / 4).toLocaleString()} $
                    </p>
                )}
            </div>
        </div>
    );
};

export default PriceSelect;
