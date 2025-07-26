'use client';

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ComponentsProvider';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const LanguageSelect = () => {
    const { i18n } = useTranslation();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const changeLocale = (lng: string) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('language', lng);

        const segments = pathname.split('/').filter(Boolean);

        if (segments.length > 0) {
            segments[0] = lng;
        } else {
            segments.unshift(lng);
        }

        const newPath = '/' + segments.join('/');

        const search = searchParams.toString();
        const fullPath = search ? `${newPath}?${search}` : newPath;

        router.replace(fullPath);
    };

    return (
        <Select onValueChange={changeLocale} value={i18n.language}>
            <SelectTrigger className="w-auto">
                <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Languages</SelectLabel>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="ru">Русский</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="uk">Українська</SelectItem>
                    <SelectItem value="pl">Polski</SelectItem>
                </SelectGroup>
            </SelectContent>
        </Select>
    );
};

export default LanguageSelect;
