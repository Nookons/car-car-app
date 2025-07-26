'use client';

import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeftRight, LoaderCircle} from "lucide-react";
import {Input} from "@/components/ui/input";
import {getYears} from "@/features/getYears";
import {IYearResponse} from "@/types/Year";

interface Props {
    minYear: string;
    maxYear: string;

    minChange: (value: string) => void;
    maxChange: (value: string) => void;
}

const YearsSelect: React.FC<Props> = ({minYear, maxYear, minChange, maxChange}) => {
    const {data: IYearResponse = {model: '', min_year: 0, max_year: 0}, isLoading, isError} = useQuery<IYearResponse>({
        queryKey: ['years_range'],
        queryFn: () => getYears(),
        staleTime: 5 * 60 * 1000,
    });


    return (
        <div>
            <article className={`my-2 text-neutral-500 text-xs`}>Years:</article>
            <div className="w-full grid grid-cols-[1fr_20px_1fr] items-center gap-4">
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
                <div>
                    <ArrowLeftRight size={14} />
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
        </div>
    );
};

export default YearsSelect;
