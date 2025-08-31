'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Check } from 'lucide-react';
import { getModelsByBrand } from '@/features/getModelsByBrand';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from '@/components/ui/command';
import { useTelegramFormStore } from '@/store/telegram-form/TelegramForm';
import { t } from 'i18next';
import { useUserStore } from "@/store/user/userStore";

export interface BrandWithModelList {
    brand: string;
    models: string[];
}

const ModelSelect = () => {
    const telegramData = useTelegramFormStore((state) => state.data);
    const models = telegramData.models; // теперь берём напрямую из Zustand
    const setTelegramModels = useTelegramFormStore((state) => state.setModels);

    const user_store = useUserStore(state => state.user_data);

    const { data, isLoading } = useQuery<BrandWithModelList[]>({
        queryKey: ['models', telegramData.brands.join(',')],
        queryFn: () => getModelsByBrand(telegramData.brands),
        enabled: !!telegramData.brands.length,
        staleTime: 5 * 60 * 1000,
    });

    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const [popoverWidth, setPopoverWidth] = useState<string | number>('auto');

    useEffect(() => {
        if (triggerRef.current) {
            setPopoverWidth(triggerRef.current.offsetWidth);
        }
    }, []);

    // Инициализация из user_store
    useEffect(() => {
        if (!isLoading && user_store?.model?.length) {
            setTelegramModels(user_store.model);
        }
    }, [isLoading, user_store?.model, setTelegramModels]);

    const pickHandler = (model: string) => {
        let updatedModels: string[];
        if (models.includes(model)) {
            updatedModels = models.filter((m) => m !== model);
        } else {
            updatedModels = [...models, model];
        }
        setTelegramModels(updatedModels);
    };

    // Оптимизированная фильтрация
    const filteredData = useMemo(() => {
        if (!data) return [];
        return data
            .map((brandItem) => ({
                ...brandItem,
                models: brandItem.models.filter((model) =>
                    model.toLowerCase().includes(search.toLowerCase())
                ),
            }))
            .filter((brandItem) => brandItem.models.length > 0);
    }, [data, search]);

    if (!data || isLoading) return null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    ref={triggerRef}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between truncate"
                >
                    {models.length > 0 ? models.join(', ') : t('telegram_form.select_models')}
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
                        placeholder={t('telegram_form.search_models')}
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList className="max-h-64 overflow-y-auto">
                        <CommandEmpty>{t('telegram_form.no_models_find')}</CommandEmpty>
                        {filteredData.map((item) => (
                            <CommandGroup heading={item.brand} key={item.brand}>
                                {item.models.map((model) => (
                                    <CommandItem
                                        key={model}
                                        value={model}
                                        onSelect={() => pickHandler(model)}
                                    >
                                        {model}
                                        {models.includes(model) && (
                                            <Check className="ml-auto h-4 w-4" />
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default ModelSelect;
