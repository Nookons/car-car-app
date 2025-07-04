'use client';

import React from 'react';
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
import {IBrand} from '@/types/Brand';
import {getAllBrands} from "@/features/getAllBrands";
import {LoaderCircle} from "lucide-react";

interface Props {
    value: string;
    onChange: (value: string) => void;
}

const BrandSelect: React.FC<Props> = ({value, onChange}) => {
    const {data: brandsData = [], isLoading, isError} = useQuery<IBrand[]>({
        queryKey: ['brands'],
        queryFn: getAllBrands,
        staleTime: 5 * 60 * 1000, // 5 минут кеша
    });

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

                    {!isLoading && !isError && brandsData.map(item => (
                        <SelectItem key={item.brand} value={item.brand.toLowerCase()}>
                            {item.brand}
                        </SelectItem>
                    ))}

                </SelectGroup>
            </SelectContent>
        </Select>
    );
};

export default BrandSelect;
