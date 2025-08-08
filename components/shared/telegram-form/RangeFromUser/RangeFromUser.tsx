import React from 'react';
import {CircleMinus, CirclePlus} from "lucide-react";
import {Slider} from "@/components/ui/slider";
import {useTelegramFormStore} from "@/store/telegram-form/TelegramForm";

const RangeFromUser = () => {
    const telegramData = useTelegramFormStore(state => state.data)
    const setRangeValue = useTelegramFormStore(state => state.setRangeValue)

    return (
        <div className={`py-6 relative`}>
            <article className={`text-neutral-500 text-x pb-4 grid grid-cols-2 items-center`}>
                Range to your new car
                <div className={`flex justify-end gap-8`}>
                    <CirclePlus
                        onClick={() => setRangeValue([telegramData.rangeValue + 10])}
                        className={`text-foreground`} size={20}
                    />
                    <CircleMinus
                        onClick={() => setRangeValue([telegramData.rangeValue - 10])}
                        className={`text-foreground`} size={20}
                    />
                </div>
            </article>
            <Slider
                value={[telegramData.rangeValue]}
                max={100}
                step={10}
                onValueChange={setRangeValue}
                className="shadow-lg rounded-lg"
            />
            <div className={`w-full py-2`}>
                {telegramData.rangeValue} km
            </div>
        </div>
    );
};

export default RangeFromUser;