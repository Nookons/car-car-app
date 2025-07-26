import React from "react";

export const generateStaticParams = () => [
    { locale: 'en' },
    { locale: 'zh' },
    { locale: 'pl' },
    { locale: 'uk' },
    { locale: 'de' },
    { locale: 'ru' },
];

type PageProps = {
    params: Promise<{ locale: string }>;
    children: React.ReactNode;
};

export default async function LocaleLayout({ children, params }: PageProps) {
    const resolvedParams = await params;

    return (
        <div lang={resolvedParams.locale}>
            {children}
        </div>
    );
}
