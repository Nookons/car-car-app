import React, {useEffect, useState} from 'react';
import {Input} from "@/components/ui/input";
import {IMileageResponse} from "@/types/Mileage";
import {Skeleton} from "@/components/ui/skeleton";
import {useTelegramFormStore} from "@/store/telegram-form/TelegramForm";
import {t} from "i18next";
import {useUserStore} from "@/store/user/userStore";
import {LoaderCircle} from "lucide-react";


const MileageSelect = () => {
    const maxMileage = useTelegramFormStore(state => state.data.maxMileage)
    const setMaxMileage = useTelegramFormStore(state => state.setMaxMileage)

    const [mileageData, setMileageData] = useState<IMileageResponse | null>(null)

    const user_millage_save = useUserStore(state => state.user_data.max_mileage)

    useEffect(() => {
        const fetchMilageData = async () => {
            try {
                const response = await fetch('/api/mileage')
                if (!response.ok) throw new Error('Network response was not ok')
                const data: IMileageResponse = await response.json()
                setMileageData(data)
            } catch (error) {
                console.error('Error fetching mileage data:', error)
            }
        }

        fetchMilageData()
    }, [])

    useEffect(() => {
        console.log(user_millage_save);
        if (user_millage_save) {
            setMaxMileage(user_millage_save)
        }
    }, [user_millage_save]);

    const handleChange = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setMaxMileage(Number(e.target.value))
        },
        [setMaxMileage]
    )

    if (!mileageData) {
        return <Skeleton className="h-[50px] rounded"/>
    }

    return (
        <div className="flex flex-col gap-2">
            <article className="text-xs text-neutral-500">
                {t("telegram_form.mileage")}
            </article>
            <div className={`relative`}>
                <Input
                    type="number"
                    value={maxMileage === 0 ? '' : maxMileage}
                    onChange={handleChange}
                    placeholder={
                        mileageData.max_mileage
                            ? `${mileageData.max_mileage.toLocaleString()} km`
                            : `${t("telegram_form.mileage_placeholder")}`
                    }
                />

                {maxMileage > 0 && (
                    <div className="absolute top-1/2 right-3 -translate-y-1/2">
                        km
                    </div>
                )}
            </div>
        </div>
    )
}

export default MileageSelect;