'use client';

import React, { Suspense, useEffect, useState } from 'react';
import LanguageSelect from "@/components/shared/LanuageSelect/LanguageSelect";
import { ModeToggle } from "@/components/shared/ModeToggle/ModeToggle";
import { useTranslation } from "react-i18next";
import UserButton from "@/components/shared/UserButton/UserButton";

const Header = () => {
    const { i18n } = useTranslation();
    const [locale, setLocale] = useState("en");

    useEffect(() => {
        const saved = localStorage.getItem('language');
        if (saved) {
            i18n.changeLanguage(saved);
            setLocale(saved);
        }
    }, [i18n]);

    return (
        <div className="w-full flex justify-between items-center p-4">
            <div>
                <h1 className="font-bold text-primary">CarCar</h1>
            </div>
            <div className="flex items-center gap-4">
                <LanguageSelect />
                <ModeToggle />
                <Suspense fallback={<div>Loading user...</div>}>
                    <UserButton />
                </Suspense>
            </div>
        </div>
    );
};

export default Header;
