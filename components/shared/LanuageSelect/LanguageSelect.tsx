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

const LanguageSelect = () => {
    const { i18n } = useTranslation();

    const changeLocale = (lng: string) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('language', lng);
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
                </SelectGroup>
            </SelectContent>
        </Select>
    );
};

export default LanguageSelect;
