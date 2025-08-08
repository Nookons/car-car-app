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
import {useTelegramFormStore} from "@/store/telegram-form/TelegramForm";
import {t} from "i18next";


export interface BrandWithModelList {
    brand: string;
    models: string; // массив строк
}


const ModelSelect = () => {
    const telegramData = useTelegramFormStore(state => state.data)
    const setTelegramModels = useTelegramFormStore(state => state.setModels)
    const filterTelegramModels = useTelegramFormStore(state => state.filterModels)

    const {data, isLoading, isError} = useQuery<BrandWithModelList[]>({
        queryKey: ['models', telegramData.brands.join(',')],
        queryFn: () => getModelsByBrand(telegramData.brands),
        enabled: !!telegramData.brands,
        staleTime: 5 * 60 * 1000,
    });


    const [models, setModels] = useState<string[]>([])

    useEffect(() => {
        setTelegramModels(models)
    }, [models])


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
            const result: {value: string, label: string}[] = []

            allModels.forEach((obj) => {
                result.push({
                    value: obj,
                    label: obj
                });
            })

            setBrandsDataFormatted(result);
            filterTelegramModels(allModels);
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
                    {models.length > 0
                        ? brandsDataFormatted
                            .filter((brand) => models.includes(brand.value))
                            .map((f) => f.label)
                            .join(", ")
                        : `${t("telegram_from.select_models")}`}
                    <ChevronsUpDown className="ml-2 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="p-0"
                style={{ width: popoverWidth }}
                align="start"
            >
                <Command>
                    <CommandInput placeholder={`${t("telegram_from.search_models")}`} className="h-9" />
                    <CommandList>
                        <CommandEmpty>{t("telegram_from.no_models_find")}</CommandEmpty>
                        <CommandGroup>
                            {brandsDataFormatted.map((model) => (
                                <CommandItem
                                    key={model.value}
                                    value={model.value}
                                    onSelect={() => {
                                        const newValue = models.includes(model.value)
                                            ? models.filter((val) => val !== model.value)
                                            : [...models, model.value];
                                        setModels(newValue);
                                        setOpen(false)
                                    }}
                                >
                                    {model.label}
                                    {models.includes(model.value) && <Check />}
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
