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
import React, {useEffect, useState} from 'react';
import {useUserStore} from "@/store/user/userStore";
import i18n from "i18next";
import {usePathname, useRouter, useSearchParams} from "next/navigation";

const LanguageSelect = () => {
    const user = useUserStore(state => state.user_data)
    const [selectedLang, setSelectedLang] = useState(user.language_code || "en");

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams(); // это хук, доступен только внутри компонента

    useEffect(() => {
        if (user.language_code) {
            handleLanguageChange(user.language_code);
        }
    }, [user]);

    const handleLanguageChange = (value: string) => {
        setSelectedLang(value);
        i18n.changeLanguage(value);

        // заменяем префикс языка в пути
        const segments = pathname.split('/');
        if (segments[1] && segments[1].length === 2) {
            segments[1] = value;
        } else {
            segments.splice(1, 0, value);
        }

        // копируем searchParams в новый объект, чтобы собрать строку
        const queryString = searchParams ? new URLSearchParams(searchParams).toString() : "";
        const newPath = segments.join('/') || '/';
        const finalUrl = queryString ? `${newPath}?${queryString}` : newPath;

        router.push(finalUrl);
    };

    return (
        <Select value={selectedLang} onValueChange={handleLanguageChange}>
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
