'use client'
import React from 'react';
import {IUserFull} from "@/types/User";
import {useQuery} from "@tanstack/react-query";
import UserMainInfo from "@/components/shared/User/UserMainInfo";
import UserButtons from "@/components/shared/User/UserButtons";
import UserSearchSettings from "@/components/shared/User/UserSearchSettings";
import {getUserByUID} from "@/features/getUserByUID";
import FavoriteList from "@/components/shared/User/FavoriteList";


type PageProps = {
    params: Promise<{
        uid: string;
    }>;
};


const Page =  ({ params }: PageProps) => {
    const resolvedParams = React.use(params);
    const uid = resolvedParams.uid;

    const {data, isLoading, isError} = useQuery<IUserFull | null>({
        queryKey: [uid],
        queryFn: () => getUserByUID(uid),
        enabled: !!uid,
        staleTime: 5 * 60 * 1000,
    });

    return (
        <div className={`px-4`}>
            <UserMainInfo data={data} isLoading={isLoading}/>
            <FavoriteList data={data} isLoadingUser={isLoading} />
            <UserSearchSettings data={data} isLoading={isLoading}/>
        </div>
    );
};

export default Page;