import React from 'react';
import {Skeleton} from "@/components/ui/skeleton";

const UserMainSkeleton = () => {
    return (
        <div className={`p-4 space-y-4`}>
            <Skeleton className={`w-full h-40`} />
            <Skeleton className={`w-full h-20`} />
            <Skeleton className={`w-full h-120`} />
        </div>
    );
};

export default UserMainSkeleton;