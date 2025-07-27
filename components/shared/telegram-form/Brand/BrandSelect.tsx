'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IBrand } from '@/types/Brand';
import { getAllBrands } from "@/features/getAllBrands";
import {
    Check,
    ChevronsUpDown
} from "lucide-react";
import {
    Button,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ComponentsProvider';
import {useTelegramFormStore} from "@/store/telegram-form/TelegramForm";


const BrandSelect = () => {
    const setBrandsStore = useTelegramFormStore(state => state.setBrands)

    const { data: brandsData = [], isLoading, isError } = useQuery<IBrand[]>({
        queryKey: ['brands'],
        queryFn: getAllBrands,
        staleTime: 5 * 60 * 1000,
    });

    const [open, setOpen] = useState(false);
    const [brandsDataFormatted, setBrandsDataFormatted] = useState<{ value: string, label: string }[]>([]);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const [popoverWidth, setPopoverWidth] = useState<string | number>('auto');

    const [brands, setBrands] = useState<string[]>([]);

    useEffect(() => {
        if (brandsData) {
            const result = brandsData.map((item) => ({
                value: item.brand,
                label: item.brand
            }));
            setBrandsDataFormatted(result);
        }
    }, [brandsData]);

    useEffect(() => {
        setBrandsStore(brands)
    }, [brands]);

    useEffect(() => {
        if (triggerRef.current) {
            setPopoverWidth(triggerRef.current.offsetWidth);
        }
    }, [triggerRef.current, brandsDataFormatted]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    ref={triggerRef}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {brands.length > 0
                        ? brandsDataFormatted
                            .filter((brand) => brands.includes(brand.value))
                            .map((f) => f.label)
                            .join(", ")
                        : "Select brand..."}
                    <ChevronsUpDown className="ml-2 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="p-0"
                style={{ width: popoverWidth }}
                align="start"
            >
                <Command>
                    <CommandInput placeholder="Search brand..." className="h-9" />
                    <CommandList>
                        <CommandEmpty>No brand found.</CommandEmpty>
                        <CommandGroup>
                            {brandsDataFormatted.map((brand) => (
                                <CommandItem
                                    key={brand.value}
                                    value={brand.value}
                                    onSelect={() => {
                                        const newValue = brands.includes(brand.value)
                                            ? brands.filter((val) => val !== brand.value)
                                            : [...brands, brand.value];
                                        setBrands(newValue);
                                        setOpen(false)
                                    }}
                                >
                                    {brand.label}
                                    {brands.includes(brand.value) && <Check />}
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
