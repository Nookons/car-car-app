import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopNav } from "@/components/desktop-nav";

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
    <html lang="ru">
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <AuthProvider>
          <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">
                  CC
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">CarCar</p>
                  <p className="text-[11px] text-muted-foreground">машины из Польши</p>
                </div>
              </div>
              <DesktopNav />
            </div>
          </header>
          <main className="mx-auto min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl px-4 pb-28 pt-4 md:pb-10">
            {children}
          </main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
