import React, {FC, useEffect, useState} from 'react';
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion";
import PriceSelect from "@/components/shared/Price/PriceSelect";
import YearsSelect from "@/components/shared/Years/YearsSelect";

interface Props {
    minYear: string;
    maxYear: string;

    setMinYear: (value: string) => void;
    setMaxYear: (value: string) => void;

    brand_value: string;
    model_value: string;
}

const YearsAccordion: React.FC<Props> = ({minYear, maxYear, setMaxYear, setMinYear, brand_value, model_value}) => {

    const [isAccordion, setIsAccordion] = useState<string>('')

    const onCLickHandler = () => {
        if (isAccordion === 'item-1') {
            setIsAccordion('');
        } else {
            setIsAccordion('item-1');
        }
    }

    useEffect(() => {
        if (brand_value) {
            setIsAccordion('item-1');
        }
    }, [brand_value]);

    return (
        <Accordion  value={isAccordion} onClick={onCLickHandler}   type="single" collapsible={true}>
            <AccordionItem value="item-1">
                <AccordionTrigger>Years Ranges</AccordionTrigger>
                <AccordionContent>
                    <div onClick={(event) => event.stopPropagation()} className="w-full">
                        <YearsSelect
                            minYear={minYear}
                            maxYear={maxYear}
                            minChange={setMinYear}
                            maxChange={setMaxYear}
                            brand_value={brand_value}
                            model_value={model_value}
                        />
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

export default YearsAccordion;