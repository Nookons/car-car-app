'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IBrand } from '@/types/Brand';
import { getAllBrands } from "@/features/getAllBrands";
import {
    AlertCircleIcon,
    Check,
    ChevronsUpDown
} from "lucide-react";
import {
    Alert,
    AlertDescription,
    AlertTitle,
    Button,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ComponentsProvider';
import { useTelegramFormStore } from "@/store/telegram-form/TelegramForm";
import { t } from "i18next";
import { useUserStore } from "@/store/user/userStore";

const BrandSelect = () => {
    const brands = useTelegramFormStore(state => state.data.brands);
    const setBrands = useTelegramFormStore(state => state.setBrands);

    const { data: brandsData = [], isLoading, isError } = useQuery<IBrand[]>({
        queryKey: ['brands'],
        queryFn: getAllBrands,
        staleTime: 5 * 60 * 1000,
    });

    const user_store = useUserStore(state => state.user_data);

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [popoverWidth, setPopoverWidth] = useState<string | number>('auto');

    // Форматируем список брендов
    const brandsDataFormatted = useMemo(() => {
        return brandsData.map(item => ({
            value: item.brand,
            label: item.brand,
        }));
    }, [brandsData]);

    // Инициализация из user_store
    useEffect(() => {
        if (user_store?.brand?.length) {
            setBrands(user_store.brand);
        }
    }, [user_store?.brand, setBrands]);

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

    const handleSelect = (brandValue: string) => {
        setBrands(
            brands.includes(brandValue)
                ? brands.filter(v => v !== brandValue)
                : [...brands, brandValue]
        );
    };

    // Фильтрация брендов по поиску
    const filteredBrands = useMemo(() => {
        if (!brandsDataFormatted.length) return [];
        return brandsDataFormatted.filter(b =>
            b.label.toLowerCase().includes(search.toLowerCase())
        );
    }, [brandsDataFormatted, search]);

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                    <ul className="list-inside list-disc text-sm">
                        <li>When try to fetch data from server we get some error</li>
                    </ul>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <span className="text-neutral-500 text-xs">{t('telegram_form.title_brand')}</span>
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
                        : t('telegram_form.select_brand')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                        placeholder={t('telegram_form.search_brands')}
                        value={search}
                        onValueChange={setSearch}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && filteredBrands.length > 0) {
                                handleSelect(filteredBrands[0].value);
                                setOpen(false);
                            }
                        }}
                    />
                    <CommandList className="max-h-64 overflow-y-auto">
                        <CommandEmpty>{t('telegram_form.no_brands_find')}</CommandEmpty>
                        <CommandGroup>
                            {filteredBrands.map(brand => (
                                <CommandItem
                                    key={brand.value}
                                    value={brand.value}
                                    onSelect={() => handleSelect(brand.value)}
                                >
                                    {brand.label}
                                    {brands.includes(brand.value) && (
                                        <Check className="ml-auto h-4 w-4" />
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
