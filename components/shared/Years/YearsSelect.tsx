'use client';

import React, {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {LoaderCircle, Truck} from "lucide-react";
import {Input} from "@/components/ui/input";
import {getYears} from "@/features/getYears";
import {IYearResponse} from "@/types/Year";

interface Props {
    minYear: string;
    maxYear: string;

    minChange: (value: string) => void;
    maxChange: (value: string) => void;

    brand_value: string;
    model_value: string;
}

const YearsSelect: React.FC<Props> = ({minYear, maxYear, minChange, maxChange, brand_value, model_value}) => {
    const {data: IYearResponse = {model: '', min_year: 0, max_year: 0}, isLoading, isError} = useQuery<IYearResponse>({
        queryKey: ['model', brand_value, model_value],
        queryFn: () => getYears(brand_value, model_value),
        staleTime: 5 * 60 * 1000,
    });


    return (
        <div className="w-full grid grid-cols-2 gap-4">
            <div className="relative">
                <Input
                    type={"number"}
                    value={minYear}
                    onChange={(event) => minChange(event.target.value)}
                    className="pr-10"
                    placeholder={isLoading ? 'Loading...' : `${IYearResponse.min_year}`}
                />
                {isLoading && (
                    <div className="absolute top-1/2 right-3 -translate-y-1/2">
                        <LoaderCircle className="animate-spin text-gray-500"/>
                    </div>
                )
                }
            </div>
            <div className="relative">
                <Input
                    type={"number"}
                    value={maxYear}
                    onChange={(event) => maxChange(event.target.value)}
                    className="pr-10"
                    placeholder={
                        isLoading
                            ? 'Loading...'
                            : `${IYearResponse.max_year}`
                    }
                />
                {isLoading && (
                    <div className="absolute top-1/2 right-3 -translate-y-1/2">
                        <LoaderCircle className="animate-spin text-gray-500"/>
                    </div>
                )
                }
            </div>
        </div>
    );
};

export default YearsSelect;
