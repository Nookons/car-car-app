import React, { Dispatch, SetStateAction } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {useTelegramFormStore} from "@/store/telegram-form/TelegramForm";

const sellerTypesInit = [
    { value: 'dealer', label: 'Autoryzowany Dealer', disabled: false },
    { value: 'firma', label: 'Firma', disabled: false },
    { value: 'private', label: 'Osoba prywatna', disabled: false },
];


const SellerSelect = () => {
    const telegramData = useTelegramFormStore(state => state.data)
    const setSellerTypes = useTelegramFormStore(state => state.setSellerTypes)

    const onSellerHandler = (type: string) => {
        if (telegramData.sellerTypes.includes(type)) {
            setSellerTypes(telegramData.sellerTypes.filter(item => item !== type));
        } else {
            setSellerTypes([...telegramData.sellerTypes, type]);
        }
    };

    return (
        <div className="w-full">
            <Accordion
                type="single"
                collapsible
                className="w-full"
                defaultValue="item-1"
            >
                <AccordionItem value="item-1">
                    <AccordionTrigger>
                        <div className="flex justify-start gap-2 items-center pb-2">
                            <article>Seller</article>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="flex flex-col gap-4 text-balance">
                        <div className="flex gap-2 flex-wrap">
                            {sellerTypesInit.map((type) => {
                                const isSelected = telegramData.sellerTypes.includes(type.value);

                                if (type.disabled) {
                                    return (
                                        <Badge
                                            key={type.value}
                                            className="px-2 transition cursor-pointer select-none"
                                            variant={'destructive'}
                                        >
                                            <article className="font-bold text-md">{type.label}</article>
                                        </Badge>
                                    );
                                }

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

export default SellerSelect;
