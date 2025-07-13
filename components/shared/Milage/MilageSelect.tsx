import React, {useEffect, useState} from 'react';
import {Input} from "@/components/ui/input";
import {IMileageResponse} from "@/types/Mileage";
import {Skeleton} from "@/components/ui/skeleton";

interface Props {
    maxMilage: number;
    setMaxMilage: (value: number) => void;
}

const MilageSelect: React.FC <Props> = ({maxMilage, setMaxMilage}) => {
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
            <Input type={`number`} value={maxMilage === 0 ? '' : maxMilage} onChange={(e) => setMaxMilage(Number(e.target.value))}
                placeholder={milageData.max_mileage ? `${milageData.max_mileage.toLocaleString()} km` : 'Enter max milage'}
            />
        </div>
    );
};

export default MilageSelect;