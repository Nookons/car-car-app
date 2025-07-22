import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import translationEN from '@/public/locales/en/translation.json';
import translationZH from '@/public/locales/zh/translation.json';
import translationRU from '@/public/locales/ru/translation.json';
import translationDE from '@/public/locales/de/translation.json';
import translationUK from '@/public/locales/uk/translation.json';
import translationPL from '@/public/locales/pl/translation.json';

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: translationEN },
            zh: { translation: translationZH },
            ru: { translation: translationRU },
            de: { translation: translationDE },
            uk: { translation: translationUK },
            pl: { translation: translationPL },
        },
        fallbackLng: 'en',
        lng: 'en', // начальный язык
        interpolation: { escapeValue: false },
    });

export default i18n;
