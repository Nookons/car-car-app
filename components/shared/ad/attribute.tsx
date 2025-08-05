import React, {useState} from 'react';
import {useTranslation} from "react-i18next";
import {Skeleton} from "@/components/ui/skeleton";
import {ICarAdd} from "@/types/Car";
import {Dot, Eye, EyeOff} from "lucide-react";

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

    if (!data) return null;

    return (
        <div className={`p-2`}>
            <article className={`text-primary/85 font-bold line-clamp-1`}>🚗 Attributes</article>
            <hr className={`my-2`}/>

            <div className={`grid grid-cols-1 gap-1 text-x mt-4`}>
                {data?.attribute.slice(0, view_count).map((el, index) => (
                    <div key={`${index}-${el}`} className="grid grid-cols-[25px_1fr] items-center">
                        <Dot size={16} className={`rounded-l`}/>
                        <span className={`line-clamp-1`}>{el}</span>
                    </div>
                ))}
                <div className={`flex justify-center mt-4 p-1 rounded-xl`}>
                    {view_count > 5
                    ?   <EyeOff onClick={() => setView_count(5)} size={22} />
                    :   <Eye onClick={() => setView_count(99)} size={22}/>
                    }
                </div>
                <hr/>
            </div>
        </div>
    );
};

export default Attribute;