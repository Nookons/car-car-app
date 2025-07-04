import type {Metadata} from "next";
import {Nunito} from "next/font/google";
import "./globals.css";
import {ThemeProvider} from "next-themes";
import Providers from "@/app/Providers";

const nunito = Nunito({
    variable: '--font-nunito',
    subsets: ['cyrillic'],
    weight: ['400', '500', '600', '700', '800', '900']
});

export const metadata: Metadata = {
    title: "CarCar Home",
    description: "Home page",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body
            className={`${nunito.className} antialiased`}
        >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <Providers>
                {children}
            </Providers>
        </ThemeProvider>
        </body>
        </html>
    );
}
