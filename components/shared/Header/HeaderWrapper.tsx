'use client'
import dynamic from 'next/dynamic';

// Отключаем SSR — он нужен только на клиенте
const HeaderClient = dynamic(() => import('./HeaderClient'), {
    ssr: false,
    loading: () => <div className="p-4">Loading header...</div>,
});

export default function HeaderWrapper() {
    return <HeaderClient />;
}
