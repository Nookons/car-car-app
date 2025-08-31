import React, {useEffect} from 'react';
import {CircleMinus, CirclePlus} from "lucide-react";
import {Slider} from "@/components/ui/slider";
import {useTelegramFormStore} from "@/store/telegram-form/TelegramForm";
import {t} from "i18next";
import { Badge } from '@/components/ComponentsProvider';
import {useUserStore} from "@/store/user/userStore";

const RangeFromUser = () => {
    const telegramData = useTelegramFormStore(state => state.data)
    const setRangeValue = useTelegramFormStore(state => state.setRangeValue)

    const user_store_range = useUserStore(state => state.user_data.from_user_range)

    useEffect(() => {
        if (user_store_range) {
            setRangeValue([user_store_range])
        }
    }, [user_store_range]);

    return (
        <div className={`relative`}>
            <div className={`text-neutral-500 text-x pb-4 grid grid-cols-2 items-center`}>
                <article className={`text-xs`}>{t("telegram_form.range_to_car")}</article>
                <div className={`grid grid-cols-[30px_30px] justify-end items-center gap-2`}>

                    <CirclePlus
                        onClick={() => setRangeValue([telegramData.rangeValue + 10])}
                        className={`text-foreground`} size={22}
                    />
                    <CircleMinus
                        onClick={() => setRangeValue([telegramData.rangeValue - 10])}
                        className={`text-foreground`} size={22}
                    />
                </div>
            </div>
            <Slider
                value={[telegramData.rangeValue]}
                max={100}
                step={10}
                onValueChange={setRangeValue}
                className="shadow-lg rounded-lg"
            />
            <div className={`w-full py-2 text-right`}>
                <Badge variant={telegramData.rangeValue > 10 ? "default" : "outline"} className={`text-foreground `}>{telegramData.rangeValue} km</Badge>
            </div>
        </div>
    );
};

export default RangeFromUser;