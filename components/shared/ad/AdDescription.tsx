import React, { useState } from 'react'
import { MousePointerClick } from "lucide-react"
import {ICarAdd} from "@/types/Car";
import {Skeleton} from "@/components/ComponentsProvider";

interface Props {
    data: {
        title?: string
        description?: string
    }
}
const AdDescription = ({data} : {data: ICarAdd | undefined}) => {
    const [isFullDescription, setIsFullDescription] = useState(false)

    if (!data) {

        return (
            <Skeleton className={`w-full h-30`} />
        )
    }

    return (
        <div
            className="w-full px-2 cursor-pointer mt-12"
            onClick={() => setIsFullDescription(!isFullDescription)}
        >
            <div className="flex justify-start text-xs items-center gap-2 mb-2">
                <MousePointerClick className="text-primary"/>
                <p className="text-neutral-500">Click to read full</p>
            </div>

            <h4 className="font-semibold text-xl mb-2">{data?.title || "No title"}</h4>

            <div
                className={`prose overflow-hidden max-w-full ${!isFullDescription ? "line-clamp-3 mask-b-from-50%" : ""}`}
                dangerouslySetInnerHTML={{ __html: (data?.description || "No description available").replace(/\n/g, "<br/>") }}
            />
        </div>
    )
};

export default AdDescription;