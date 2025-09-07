export {}; // чтобы файл стал модулем

declare module "*.json" {
    const value: any;
    export default value;
}

declare global {
    interface Window {
        Telegram: {
            WebApp: TelegramWebApp;
        };
    }
}

interface TelegramWebApp {
    /** Current platform: "ios", "android", "tdesktop", "macos", "web", etc. */
    platform: string;

    /** Current color scheme: "light" | "dark" */
    colorScheme: "light" | "dark";

    /** User and chat data (parsed from initData) */
    initData: string;
    initDataUnsafe: {
        query_id?: string;
        user?: TelegramUser;
        receiver?: TelegramUser;
        chat?: TelegramChat;
        start_param?: string;
        auth_date?: string;
        hash?: string;
    };

    /** Expand WebApp to maximum height */
    expand: () => void;

    /** Close the WebApp */
    close: () => void;

    /** Move viewport to position */
    scrollTo: (x: number, y: number) => void;

    /** Enable vertical scrolling */
    enableClosingConfirmation: () => void;
    disableClosingConfirmation: () => void;

    /** Events */
    onEvent: (eventType: TelegramEventType, callback: (...args: any[]) => void) => void;
    offEvent: (eventType: TelegramEventType, callback: (...args: any[]) => void) => void;

    /** Theme params */
    themeParams: TelegramThemeParams;

    /** Haptic feedback */
    HapticFeedback: {
        impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
        notificationOccurred: (type: "error" | "success" | "warning") => void;
        selectionChanged: () => void;
    };

    /** BackButton */
    BackButton: {
        isVisible: boolean;
        show: () => void;
        hide: () => void;
        onClick: (cb: () => void) => void;
        offClick: (cb: () => void) => void;
    };

    /** MainButton */
    MainButton: {
        text: string;
        color: string;
        textColor: string;
        isVisible: boolean;
        isProgressVisible: boolean;
        isActive: boolean;

        setText: (text: string) => void;
        onClick: (cb: () => void) => void;
        offClick: (cb: () => void) => void;
        show: () => void;
        hide: () => void;
        enable: () => void;
        disable: () => void;
        showProgress: (leaveActive?: boolean) => void;
        hideProgress: () => void;
        setParams: (params: Partial<TelegramButtonParams>) => void;
    };

    /** Safe send data back to bot */
    sendData: (data: string) => void;

    /** WebApp initialization complete */
    ready: () => void;

    /** Show popup */
    showPopup: (
        params: {
            title?: string;
            message: string;
            buttons?: { id?: string; type?: "default" | "ok" | "close" | "cancel" | "destructive"; text?: string }[];
        },
        callback?: (buttonId: string) => void
    ) => void;

    /** Show alert */
    showAlert: (message: string, callback?: () => void) => void;

    /** Show confirm */
    showConfirm: (message: string, callback: (ok: boolean) => void) => void;

    /** QR scanner */
    openQrScanner: (callback: (text: string) => void, options?: { text?: string }) => void;

    /** Clipboard */
    readTextFromClipboard: (callback: (text: string) => void) => void;
}

type TelegramEventType =
    | "themeChanged"
    | "viewportChanged"
    | "mainButtonClicked"
    | "backButtonClicked";

interface TelegramUser {
    id: number;
    is_bot?: boolean;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    allows_write_to_pm?: boolean;
    photo_url?: string;
}

interface TelegramChat {
    id: number;
    type: "group" | "supergroup" | "channel";
    title?: string;
    username?: string;
    photo_url?: string;
}

interface TelegramThemeParams {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
}

interface TelegramButtonParams {
    text: string;
    color: string;
    text_color: string;
    is_active: boolean;
    is_visible: boolean;
}




