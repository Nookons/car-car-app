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
import React, { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useUserStore } from "@/store/user/userStore";

const LanguageSelect = () => {
    const { i18n } = useTranslation();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const user_store = useUserStore((state) => state.user_data);

    // Нормализуем код языка (чтобы en-US → en)
    const normalizeLang = (lng: string) => lng.split('-')[0];

    const changeLocale = useCallback(
        (lng: string) => {
            const normalizedLng = normalizeLang(lng);
            if (i18n.language !== normalizedLng) {
                i18n.changeLanguage(normalizedLng);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('language', normalizedLng);
                }

                const segments = pathname.split('/').filter(Boolean);
                if (segments.length > 0) {
                    segments[0] = normalizedLng;
                } else {
                    segments.unshift(normalizedLng);
                }

                const newPath = '/' + segments.join('/');
                const search = searchParams.toString();
                const fullPath = search ? `${newPath}?${search}` : newPath;

                router.replace(fullPath);
            }
        },
        [i18n, pathname, searchParams, router]
    );

    useEffect(() => {
        const languageFromUrl = normalizeLang(pathname.split('/')[1] || 'en');

        if (
            user_store?.language_code &&
            languageFromUrl !== user_store.language_code &&
            normalizeLang(i18n.language) !== user_store.language_code
        ) {
            console.log('Change language to user setting:', user_store.language_code);
            changeLocale(user_store.language_code);
        }
    }, [user_store, pathname, i18n.language, changeLocale]);

    return (
        <Select onValueChange={changeLocale} value={normalizeLang(i18n.language)}>
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
