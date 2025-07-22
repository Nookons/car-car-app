'use client';

import {ReactNode, useEffect} from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from "@/app/i18n/i18n";
import {QueryClientProvider} from "@tanstack/react-query";
import {queryClient} from "@/lib/query-client";


export default function Providers({ children }: { children: ReactNode }) {
    useEffect(() => {
        // Ничего не делаем — просто нужна инициализация
    }, []);

    return (
        <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </I18nextProvider>
    )
}
