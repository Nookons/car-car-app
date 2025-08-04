'use client'
import dynamic from 'next/dynamic';
import {Skeleton} from "@/components/ComponentsProvider";

// Отключаем SSR — он нужен только на клиенте
const HeaderClient = dynamic(() => import('./HeaderClient'), {
    ssr: false,
    loading: () => <div className={`p-2`}>
        <Skeleton className="w-full h-10"></Skeleton>
    </div>,
});

export default function HeaderWrapper() {
    return <HeaderClient />;
}
