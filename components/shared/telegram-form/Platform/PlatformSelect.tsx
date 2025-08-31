import React, {useCallback, useEffect, useMemo} from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useTelegramFormStore } from "@/store/telegram-form/TelegramForm";
import {t} from "i18next";
import {useUserStore} from "@/store/user/userStore";

interface PlatformType {
    value: string;
    label: string;
    disabled: boolean;
}

const platformTypesInit: PlatformType[] = [
    { value: 'oto_moto', label: 'OTO MOTO', disabled: false },
    { value: 'olx', label: 'OLX', disabled: true },
    { value: 'facebook', label: 'Facebook', disabled: true },
    { value: 'sprzedajemy', label: 'Sprzedajemy Pl', disabled: true },
];

const PlatformSelect = () => {
    const platformTypes = useTelegramFormStore(state => state.data.platformTypes);
    const setPlatformTypes = useTelegramFormStore(state => state.setPlatformTypes);

    const user_store_platforms = useUserStore(state => state.user_data.platform_types);

    useEffect(() => {
        if (user_store_platforms) {
            setPlatformTypes(user_store_platforms);
        }
    }, [user_store_platforms]);

    const onPlatformsPick = (type: string) => {
        if (platformTypes.includes(type)) {
            setPlatformTypes(platformTypes.filter(item => item !== type));
        } else {
            setPlatformTypes([...platformTypes, type]);
        }
    };

    // Мемоизация списка платформ
    const memoizedPlatformTypes = useMemo(() => platformTypesInit, []);

    return (
        <div className="w-full">
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                    <AccordionTrigger>
                        <div className="flex justify-start gap-2 items-center pb-2">
                            <article>{t("telegram_form.platforms_label")}</article>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="flex flex-col gap-4 text-balance">
                        <div className="flex gap-2 flex-wrap">
                            {memoizedPlatformTypes.map((type) => {
                                const isSelected = platformTypes.includes(type.value);

                                if (type.disabled) {
                                    return (
                                        <Badge
                                            key={type.value}
                                            className="px-2 text-foreground transition opacity-50 cursor-not-allowed select-none"
                                            variant={'destructive'}
                                        >
                                            <article className="font-bold text-md">{type.label}</article>
                                        </Badge>
                                    );
                                }

                                return (
                                    <Badge
                                        key={type.value}
                                        className="px-2 text-foreground transition cursor-pointer select-none"
                                        variant={isSelected ? 'default' : 'secondary'}
                                        onClick={() => onPlatformsPick(type.value)}
                                    >
                                        <article className="font-bold text-md">{type.label}</article>
                                    </Badge>
                                );
                            })}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
};

export default PlatformSelect;