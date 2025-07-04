'use client';

import React, {use, useEffect} from 'react';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {useQuery} from '@tanstack/react-query';
import {LoaderCircle} from "lucide-react";
import {getModelsByBrand} from "@/features/getModelsByBrand";
import {IModelsResponse} from "@/types/Model";

interface Props {
    value: string;
    onChange: (value: string) => void;
    search_value: string;
}

const ModelSelect: React.FC<Props> = ({value, onChange, search_value}) => {
    const {data: IModelsResponse = {brand: '', models: ''}, isLoading, isError} = useQuery<IModelsResponse>({
        queryKey: ['brands', search_value],
        queryFn: () => getModelsByBrand(search_value),
        enabled: !!search_value,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        onChange('')
    }, [search_value])


    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder={isLoading ? <LoaderCircle className={`animate-spin`}/> : 'Select a brand'}/>
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Brand</SelectLabel>

                    {isLoading &&
                        <SelectItem disabled value="loading">
                            <LoaderCircle className={`animate-spin`}/>
                        </SelectItem>}

                    {isError && <SelectItem disabled value="error">Failed to load brands</SelectItem>}

                    {!isLoading && !isError &&
                        Array.from(new Set(IModelsResponse.models.split(', ').map(m => m.trim())))
                            .sort()
                            .map((model) => (
                                <SelectItem key={model} value={model}>
                                    {model}
                                </SelectItem>
                            ))}

                </SelectGroup>
            </SelectContent>
        </Select>
    );
};

export default ModelSelect;
