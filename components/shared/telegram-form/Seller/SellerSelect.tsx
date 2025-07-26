import React, { Dispatch, SetStateAction } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

const sellerTypesInit = [
    { value: 'dealer', label: 'Autoryzowany Dealer' },
    { value: 'firma', label: 'Firma' },
    { value: 'private', label: 'Osoba prywatna' },
];

interface Props {
    sellerTypes: string[];
    change: Dispatch<SetStateAction<string[]>>;
}

const SellerSelect: React.FC<Props> = ({ sellerTypes, change }) => {

    const onSellerHandler = (type: string) => {
        if (sellerTypes.includes(type)) {
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
                                const isSelected = sellerTypes.includes(type.value);
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
