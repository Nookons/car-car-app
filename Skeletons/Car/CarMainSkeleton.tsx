import React from 'react';
import {Skeleton} from "@/components/ui/skeleton";

const CarMainSkeleton = () => {
    return (
        <div className={`p-4 space-y-4`}>
            <Skeleton className={`w-full h-10`} />
            <Skeleton className={`w-full h-60`} />
            <Skeleton className={`w-full h-20`} />
            <Skeleton className={`w-full h-20`} />
            <Skeleton className={`w-full h-130`} />
            <Skeleton className={`w-full h-50`} />
        </div>
    );
};

export default CarMainSkeleton;