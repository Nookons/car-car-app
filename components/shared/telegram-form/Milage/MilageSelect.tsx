import React, {useEffect, useState} from 'react';
import {Input} from "@/components/ui/input";
import {IMileageResponse} from "@/types/Mileage";
import {Skeleton} from "@/components/ui/skeleton";
import {useTelegramFormStore} from "@/store/telegram-form/TelegramForm";



const MilageSelect= () => {
    const telegramData = useTelegramFormStore(state => state.data)
    const setMaxMilage = useTelegramFormStore(state => state.setMaxMilage)
    const [milageData, setMilageData] = useState<IMileageResponse | null>(null)

    useEffect(() => {
        const fetchMilageData = async () => {
            try {
                const response = await fetch('/api/mileage');
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data: IMileageResponse = await response.json();
                setMilageData(data);
            } catch (error) {
                console.error('Error fetching milage data:', error);
            }
        };

        fetchMilageData();
    }, [])

    if (!milageData) {
        return <Skeleton className="h-[50px] rounded" />
    }

    return (
        <div className={`flex flex-col gap-2`}>
            <article>Milage</article>
            <Input
                type={`number`}
                value={telegramData.maxMilage === 0 ? '' : telegramData.maxMilage}
                onChange={(e) => setMaxMilage(Number(e.target.value))}
                placeholder={milageData.max_mileage ? `${milageData.max_mileage.toLocaleString()} km` : 'Enter max milage'}
            />
        </div>
    );
};

export default MilageSelect;