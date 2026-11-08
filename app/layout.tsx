import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";
import { AppHeader } from "@/components/app-header";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "CarCar — машины из Польши",
  description: "Агрегатор объявлений о продаже авто в Польше",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#f6f7f9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <I18nProvider>
          <AuthProvider>
            <AppHeader />
            <main className="mx-auto min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl px-4 pb-28 pt-4 md:pb-10">
              {children}
            </main>
            <BottomNav />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
