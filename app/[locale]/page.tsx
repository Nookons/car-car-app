'use client';

import { useTranslation } from 'react-i18next';
import {useEffect, useState} from 'react';

export default function Home() {
    const { t, i18n } = useTranslation();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (i18n.isInitialized) {
            setReady(true);
        } else {
            i18n.on('initialized', () => setReady(true));
        }
    }, [i18n]);

    if (!ready) return null; // или <Skeleton />

    return (
        <main style={{ padding: 20 }}>
            <h1>{t('greeting')}</h1>
            <p>{t('change_language')}</p>
        </main>
    );
}
