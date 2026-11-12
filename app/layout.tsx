import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";
import { Funnel } from "@/components/funnel";
import { LegalFooter } from "@/components/legal-footer";
import { AppHeader } from "@/components/app-header";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.NODE_ENV === "production"
        ? "https://car-car-app.vercel.app"
        : "http://localhost:3006"),
  ),
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var k='carcar.theme',v=localStorage.getItem(k)||'system',tg=window.Telegram&&window.Telegram.WebApp,real=tg&&tg.initData,s=real&&tg.colorScheme,d=v==='dark'||(v==='system'&&(s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches));var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';r.style.backgroundColor=d?'#000000':'#f6f7f9';if(tg){var c=d?'#000000':'#f6f7f9';tg.setHeaderColor&&tg.setHeaderColor(c);tg.setBackgroundColor&&tg.setBackgroundColor(c);tg.setBottomBarColor&&tg.setBottomBarColor(c);}}catch(e){}})();",
          }}
        />
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <Funnel />
              <AppHeader />
              <main className="mx-auto min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl px-4 pb-28 pt-4 md:pb-10">
                {children}
              </main>
              <BottomNav />
              <LegalFooter />
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
