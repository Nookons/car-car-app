'use client';

import React, {useEffect} from 'react';
import LanguageSelect from "@/components/shared/LanuageSelect/LanguageSelect";
import {ModeToggle} from "@/components/shared/ModeToggle/ModeToggle";
import {usePathname} from "next/navigation";
import {useTranslation} from "react-i18next";

const Header = () => {
    const { i18n } = useTranslation();
    const pathname = usePathname();
    const localeFromPath = pathname.split('/')[1];

    const changeLocale = (lng: string) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('language', lng);
    };

    useEffect(() => {
        changeLocale(localeFromPath)
    }, [localeFromPath]);

    return (
        <div className={`w-full flex justify-between items-center p-4`}>
            <div>
                <h1 className={`font-bold text-primary`}>CarCar</h1>
            </div>
            <div className={`flex items-center gap-4`}>
                <LanguageSelect/>
                <ModeToggle />
            </div>
        </div>
    );
};

export default Header;