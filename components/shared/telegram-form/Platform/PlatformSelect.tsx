import React, { Dispatch, SetStateAction } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

const platformTypesInit = [
    { value: 'oto_moto', label: 'Oto Moto' },
    { value: 'olx', label: 'Olx' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'sprzedajemy', label: 'Sprzedajemy Pl' },
]

interface Props {
    platformTypes: string[];
    change: Dispatch<SetStateAction<string[]>>;
}

const PlatformSelect: React.FC<Props> = ({ platformTypes, change }) => {

    const onSellerHandler = (type: string) => {
        if (platformTypes.includes(type)) {
            change(prev => prev.filter(item => item !== type));
        } else {
            change(prev => [...prev, type]);
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
                                const isSelected = platformTypes.includes(type.value);
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
