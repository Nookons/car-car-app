export {}; // чтобы файл стал модулем

declare module "*.json" {
    const value: any;
    export default value;
}

declare global {
    interface Window {
        Telegram?: {
            WebApp?: {
                initDataUnsafe?: {
                    user?: {
                        username?: string;
                    };
                };
                sendData: (data: string) => void;
                expand: () => void;
                onEvent: (event: string, callback: () => void) => void;
                offEvent: (event: string, callback: () => void) => void;
            };
        };
    }
}


