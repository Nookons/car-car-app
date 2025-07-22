// app/[locale]/layout.tsx

export const generateStaticParams = () => [
    { locale: 'en' },
    { locale: 'zh' },
];

export default async function LocaleLayout({
                                               children,
                                               params,
                                           }: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>; // params теперь Promise
}) {
    const { locale } = await params; // await здесь обязателен

    return (
        <html lang={locale}>
        <body>{children}</body>
        </html>
    );
}
