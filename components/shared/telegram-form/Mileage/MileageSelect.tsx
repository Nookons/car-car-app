import React, {useEffect, useState} from 'react';
import {Input} from "@/components/ui/input";
import {IMileageResponse} from "@/types/Mileage";
import {Skeleton} from "@/components/ui/skeleton";
import {useTelegramFormStore} from "@/store/telegram-form/TelegramForm";
import {t} from "i18next";



const MileageSelect = () => {
    const maxMileage = useTelegramFormStore(state => state.data.maxMileage)
    const setMaxMileage = useTelegramFormStore(state => state.setMaxMileage)

    const [mileageData, setMileageData] = useState<IMileageResponse | null>(null)

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

    const handleChange = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setMaxMileage(Number(e.target.value))
        },
        [setMaxMileage]
    )

    if (!mileageData) {
        return <Skeleton className="h-[50px] rounded" />
    }

    return (
        <div className="flex flex-col gap-2">
            <article className="text-xs text-neutral-500">
                {t("telegram_form.mileage")}
            </article>
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
        </div>
    )
}

export default MileageSelect;