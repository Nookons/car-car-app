'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IBrand } from '@/types/Brand';
import { getAllBrands } from "@/features/getAllBrands";
import {
    AlertCircleIcon,
    Check,
    ChevronsUpDown
} from "lucide-react";
import {
    Alert, AlertDescription, AlertTitle,
    Button,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Popover,
    PopoverContent,
    PopoverTrigger, Skeleton
} from '@/components/ComponentsProvider';
import { useTelegramFormStore } from "@/store/telegram-form/TelegramForm";
import {t} from "i18next";

const BrandSelect = () => {
    const setBrandsStore = useTelegramFormStore(state => state.setBrands);
    const { data: brandsData = [], isLoading, isError } = useQuery<IBrand[]>({
        queryKey: ['brands'],
        queryFn: getAllBrands,
        staleTime: 5 * 60 * 1000,
    });

    const [open, setOpen] = useState(false);
    const [brands, setBrands] = useState<string[]>([]);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [popoverWidth, setPopoverWidth] = useState<string | number>('auto');

    // Оптимизированное преобразование данных
    const brandsDataFormatted = useMemo(() => {
        return brandsData.map(item => ({
            value: item.brand,
            label: item.brand
        }));
    }, [brandsData]);

    // Синхронизация с глобальным состоянием
    useEffect(() => {
        setBrandsStore(brands);
    }, [brands, setBrandsStore]);

    // Установка ширины popover
    useEffect(() => {
        if (!triggerRef.current) return;

        const updateWidth = () => {
            setPopoverWidth(triggerRef.current?.offsetWidth || 'auto');
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);

        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    const handleEnter = () => {
        setOpen(false);
    };

    // Оптимизированный обработчик выбора
    const handleSelect = useCallback((brandValue: string) => {
        setBrands(prev =>
            prev.includes(brandValue)
                ? prev.filter(v => v !== brandValue)
                : [...prev, brandValue]
        );
    }, []);

    if (isError) return (
        <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
                <ul className="list-inside list-disc text-sm">
                    <li>When try to fetch data from server we get some error</li>
                </ul>
            </AlertDescription>
        </Alert>
    )
    ;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <span className={`text-neutral-500 text-xs`}>{t('telegram_form.title_brand')}</span>
            <PopoverTrigger asChild>
                <Button
                    ref={triggerRef}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between truncate"
                >
                    {brands.length > 0
                        ? brandsDataFormatted
                            .filter(brand => brands.includes(brand.value))
                            .map(f => f.label)
                            .join(", ")
                        : `${t('telegram_form.select_brand')}`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="p-0"
                style={{ width: popoverWidth }}
                align="start"
                side="bottom"
                sideOffset={4}
            >
                <Command>
                    <CommandInput
                        autoFocus={false}
                        placeholder={`${t('telegram_form.search_brands')}`}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleEnter();
                            }
                        }}
                    />
                    <CommandList>
                        <CommandEmpty>{t('telegram_form.no_brands_find')}</CommandEmpty>
                        <CommandGroup>
                            {brandsDataFormatted.map(brand => (
                                <CommandItem
                                    key={brand.value}
                                    value={brand.value}
                                    onSelect={() => handleSelect(brand.value)}
                                >
                                    {brand.label}
                                    {brands.includes(brand.value) && (
                                        <Check className="ml-auto h-4 w-4"/>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default BrandSelect;