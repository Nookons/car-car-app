interface TelegramWebApp {
    sendData: (data: string) => void;
    onEvent: (eventName: string, callback: () => void) => void;
    offEvent: (eventName: string, callback: () => void) => void;
    initDataUnsafe?: {
        user?: {
            username?: string;
        };
    };
}

interface Window {
    Telegram?: {
        WebApp: TelegramWebApp;
    };
}
