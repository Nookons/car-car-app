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

    search_value: string;
    type: string;
}

const PriceSelect: React.FC<Props> = ({minPrice, maxPrice, minChange, maxChange, type, search_value}) => {
    const {data: IPriceResponse = {brand: '', min_price: 0, max_price: 0}, isLoading, isError} = useQuery<IPriceResponse>({
        queryKey: ['brands', search_value],
        queryFn: () => getPrices(search_value, type),
        enabled: !!search_value,
        staleTime: 5 * 60 * 1000,
    });

    return (
        <div>
            <article className={`text-xs text-neutral-500 my-2`}>Price range for this car</article>
            <div className="w-full grid grid-cols-2 gap-4">
                <div className="relative">
                    <Input
                        type="number"
                        value={minPrice === 0 ? '' : minPrice}
                        onChange={(event) => minChange(Number(event.target.value))}
                        min={IPriceResponse.min_price}
                        max={IPriceResponse.max_price}
                        className="pr-10"
                        placeholder={isLoading ? 'Loading...' : `${IPriceResponse.min_price.toLocaleString()} PLN`}
                    />
                    {isLoading ? (
                            <div className="absolute top-1/2 right-3 -translate-y-1/2">
                                <LoaderCircle className="animate-spin text-gray-500" />
                            </div>
                        )
                        :
                        (
                            <div className="absolute top-1/2 right-3 -translate-y-1/2">
                                <Truck className="animate-bounce text-gray-500" />
                            </div>
                        )
                    }
                </div>
                <div className="relative">
                    <Input
                        value={maxPrice === 0 ? '' : maxPrice}
                        onChange={(event) => maxChange(Number(event.target.value))}
                        type="number"
                        min={minPrice}
                        max={IPriceResponse.max_price}
                        className="pr-10"
                        placeholder={
                            isLoading
                                ? 'Loading...'
                                : `${IPriceResponse.max_price.toLocaleString()} PLN`
                        }
                    />
                    {isLoading ? (
                            <div className="absolute top-1/2 right-3 -translate-y-1/2">
                                <LoaderCircle className="animate-spin text-gray-500" />
                            </div>
                        )
                        :
                        (
                            <div className="absolute top-1/2 right-3 -translate-y-1/2">
                                <Truck className="animate-bounce text-gray-500" />
                            </div>
                        )
                    }
                </div>
            </div>
        </div>
    );
};

export default PriceSelect;
