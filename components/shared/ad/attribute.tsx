import React, {useState} from 'react';
import {useTranslation} from "react-i18next";
import {Skeleton} from "@/components/ui/skeleton";
import {ICarAdd} from "@/types/Car";
import {Dot, Eye, EyeOff, MousePointerClick, SquareAsterisk} from "lucide-react";

interface Props {
    data: ICarAdd | undefined;
    isLoading: boolean;
}

const Attribute: React.FC<Props> = ({data, isLoading}) => {
    const { t } = useTranslation();

    const [view_count, setView_count] = useState<number>(5);

    if (isLoading) {
        return (
            <div className={`grid grid-cols-3 gap-2 mt-4 text-sm text-center`}>
                <Skeleton className={`w-full h-60`}/>
            </div>
        )
    }

    if (!data?.attribute) return null;

    return (
        <div className={`p-2`}>
            <div className={`flex justify-start text-xs items-center gap-2 mb-4 `}>
                <MousePointerClick className={`text-primary`} />
                <p className={`text-neutral-500`}>Click to read full</p>
            </div>

            <div onClick={() => setView_count(view_count > 5 ? 5 : 99)} className={`grid grid-cols-1 gap-1 text-x mt-4 ${view_count === 5 && "mask-b-from-50%"}`}>
                {data?.attribute.slice(0, view_count).map((el, index) => (
                    <div key={`${index}-${el}`} className="grid grid-cols-[25px_1fr] items-center">
                        <SquareAsterisk  size={16} className={`rounded-l`}/>
                        <span className={`line-clamp-1`}>{el}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Attribute;