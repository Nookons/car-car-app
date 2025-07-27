import React, { Dispatch, SetStateAction } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {useTelegramFormStore} from "@/store/telegram-form/TelegramForm";

const platformTypesInit = [
    { value: 'oto_moto', label: 'Oto Moto' },
    { value: 'olx', label: 'Olx' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'sprzedajemy', label: 'Sprzedajemy Pl' },
]


const PlatformSelect = () => {
    const telegramData = useTelegramFormStore(state => state.data)
    const setPlatformTypes = useTelegramFormStore(state => state.setPlatformTypes)

    const onSellerHandler = (type: string) => {
        if (telegramData.platformTypes.includes(type)) {
            setPlatformTypes(telegramData.platformTypes.filter(item => item !== type));
        } else {
            setPlatformTypes([...telegramData.platformTypes, type]);
        }
    };

    return (
        <div className="w-full">
            <Accordion
                type="single"
                collapsible
                className="w-full"
            >
                <AccordionItem value="item-1">
                    <AccordionTrigger>
                        <div className="flex justify-start gap-2 items-center pb-2">
                            <article>Platform</article>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="flex flex-col gap-4 text-balance">
                        <div className="flex gap-2 flex-wrap">
                            {platformTypesInit.map((type) => {
                                const isSelected = telegramData.platformTypes.includes(type.value);
                                return (
                                    <Badge
                                        key={type.value}
                                        className="px-2 transition cursor-pointer select-none"
                                        variant={isSelected ? 'default' : 'secondary'}
                                        onClick={() => onSellerHandler(type.value)}
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
