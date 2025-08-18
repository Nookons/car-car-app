import React, { Dispatch, SetStateAction } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {useTelegramFormStore} from "@/store/telegram-form/TelegramForm";
import {t} from "i18next";

const conditionTypesInit = [
    { value: 'used', label: 'Używany' },
    { value: 'new', label: 'Nowy' },
]

const ConditionSelect = () => {
    const telegramData = useTelegramFormStore(state => state.data)
    const setConditionTypes = useTelegramFormStore(state => state.setConditionTypes)

    const onSellerHandler = (type: string) => {
        if (telegramData.conditionTypes.includes(type)) {
            setConditionTypes(telegramData.conditionTypes.filter(item => item !== type));
        } else {
            setConditionTypes([...telegramData.conditionTypes, type]);
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
                            <article>{t("telegram_form.conditions_label")}</article>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="flex flex-col gap-4 text-balance">
                        <div className="flex gap-2 flex-wrap">
                            {conditionTypesInit.map((type) => {
                                const isSelected = telegramData.conditionTypes.includes(type.value);
                                return (
                                    <Badge
                                        key={type.value}
                                        className="px-2 text-foreground transition cursor-pointer select-none"
                                        variant={isSelected ? 'default' : 'secondary'}
                                        onClick={() => onSellerHandler(type.value)}
                                    >
                                        <article className="font-bold text-md">{t(`${type.value}`)}</article>
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

export default ConditionSelect;
