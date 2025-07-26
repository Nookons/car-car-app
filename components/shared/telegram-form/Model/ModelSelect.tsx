'use client';

import React, {use, useEffect, useRef, useState} from 'react';
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
import {Check, ChevronsUpDown, LoaderCircle} from "lucide-react";
import {getModelsByBrand} from "@/features/getModelsByBrand";
import {IModelsResponse} from "@/types/Model";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Button} from "@/components/ui/button";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from "@/components/ui/command";

interface Props {
    value: string[];
    onChange: (value: string[]) => void;
    search_value: string[];
}


export interface BrandWithModelList {
    brand: string;
    models: string; // массив строк
}


const ModelSelect: React.FC<Props> = ({value, onChange, search_value}) => {
    const {data, isLoading, isError} = useQuery<BrandWithModelList[]>({
        queryKey: ['brands', search_value],
        queryFn: () => getModelsByBrand(search_value),
        enabled: !!search_value,
        staleTime: 5 * 60 * 1000,
    });

    const [open, setOpen] = useState(false);
    const [brandsDataFormatted, setBrandsDataFormatted] = useState<{ value: string, label: string }[]>([]);


    const triggerRef = useRef<HTMLButtonElement>(null);
    const [popoverWidth, setPopoverWidth] = useState<string | number>('auto');

    useEffect(() => {
        if (triggerRef.current) {
            setPopoverWidth(triggerRef.current.offsetWidth);
        }
    }, [triggerRef.current, brandsDataFormatted]);

    useEffect(() => {
        if (data) {
            const allModels: string[] = data.flatMap((item) => item.models.split(',').map((model) => model.trim()));

            console.log(allModels);

            allModels.forEach((obj) => {
                setBrandsDataFormatted((prev) => ([...prev, { value: obj, label: obj}]))
            })
        }
    }, [data])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {value.length > 0
                        ? brandsDataFormatted
                            .filter((brand) => value.includes(brand.value))
                            .map((f) => f.label)
                            .join(", ")
                        : "Select models..."}
                    <ChevronsUpDown className="ml-2 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="p-0"
                style={{ width: popoverWidth }}
                align="start"
            >
                <Command>
                    <CommandInput placeholder="Search models..." className="h-9" />
                    <CommandList>
                        <CommandEmpty>No models found.</CommandEmpty>
                        <CommandGroup>
                            {brandsDataFormatted.map((model) => (
                                <CommandItem
                                    key={model.value}
                                    value={model.value}
                                    onSelect={() => {
                                        const newValue = value.includes(model.value)
                                            ? value.filter((val) => val !== model.value)
                                            : [...value, model.value];
                                        onChange(newValue);
                                        setOpen(false)
                                    }}
                                >
                                    {model.label}
                                    {value.includes(model.value) && <Check />}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default ModelSelect;
