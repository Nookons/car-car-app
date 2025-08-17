'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Check } from 'lucide-react';
import { getModelsByBrand } from '@/features/getModelsByBrand';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useTelegramFormStore } from '@/store/telegram-form/TelegramForm';
import { t } from 'i18next';

export interface BrandWithModelList {
    brand: string;
    models: string[];
}

const ModelSelect = () => {
    const telegramData = useTelegramFormStore((state) => state.data);
    const setTelegramModels = useTelegramFormStore((state) => state.setModels);

    const { data, isLoading } = useQuery<BrandWithModelList[]>({
        queryKey: ['models', telegramData.brands.join(',')],
        queryFn: () => getModelsByBrand(telegramData.brands),
        enabled: !!telegramData.brands.length,
        staleTime: 5 * 60 * 1000,
    });

    const [models, setModels] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const [popoverWidth, setPopoverWidth] = useState<string | number>('auto');

    useEffect(() => {
        if (triggerRef.current) {
            setPopoverWidth(triggerRef.current.offsetWidth);
        }
    }, [triggerRef.current]);

    const pickHandler = (model: string) => {
        let updatedModels: string[];
        if (models.includes(model)) {
            updatedModels = models.filter((m) => m !== model);
        } else {
            updatedModels = [...models, model];
        }
        setModels(updatedModels);
        setTelegramModels(updatedModels);
    };

    if (!data || isLoading) return null;

    // Фильтруем модели по поиску
    const filteredData = data
        .map((brandItem) => ({
            ...brandItem,
            models: brandItem.models.filter((model) =>
                model.toLowerCase().includes(search.toLowerCase())
            ),
        }))
        .filter((brandItem) => brandItem.models.length > 0);


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
            <PopoverContent className="p-0" style={{ width: popoverWidth }} align="start">
                <Command>
                    <CommandInput
                        placeholder={t('telegram_form.search_models')}
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        <CommandEmpty>{t('telegram_form.no_models_find')}</CommandEmpty>
                        {filteredData.map((item) => (
                            <CommandGroup heading={item.brand} key={item.brand}>
                                {item.models.map((model) => (
                                    <CommandItem key={model} value={model} onSelect={() => pickHandler(model)}>
                                        {model}
                                        {models.includes(model) && <Check className="ml-auto h-4 w-4" />}
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
