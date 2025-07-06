import React, {FC, useEffect, useState} from 'react';
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion";
import PriceSelect from "@/components/shared/Price/PriceSelect";

interface Props {
    brandValue: string;
    model: string;
    minPrice: number;
    maxPrice: number;
    setMinPrice: (value: number) => void;
    setMaxPrice: (value: number) => void;
}

const PriceAccordion: React.FC<Props> = ({brandValue, model, minPrice, maxPrice, setMaxPrice, setMinPrice}) => {

    const [isAccordion, setIsAccordion] = useState<string>('')

    const onCLickHandler = () => {
        if (isAccordion === 'item-1') {
            setIsAccordion('');
        } else {
            setIsAccordion('item-1');
        }
    }

    useEffect(() => {
        if (brandValue) {
            setIsAccordion('item-1');
        }
    }, [brandValue]);

    return (
        <Accordion value={isAccordion} onClick={onCLickHandler} type="single" collapsible>
            <AccordionItem value="item-1">
                <AccordionTrigger>Price Ranges</AccordionTrigger>
                <AccordionContent>
                    <div onClick={(event) => event.stopPropagation()} className="w-full pb-4">
                        <PriceSelect
                            minPrice={minPrice}
                            maxPrice={maxPrice}
                            minChange={setMinPrice}
                            maxChange={setMaxPrice}
                            model_value={model}
                            brand_value={brandValue}
                        />
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

export default PriceAccordion;