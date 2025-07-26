'use client'
import React from 'react';
import {IUserFull} from "@/types/User";
import {useQuery} from "@tanstack/react-query";
import UserMainInfo from "@/components/shared/User/UserMainInfo";
import UserButtons from "@/components/shared/User/UserButtons";
import UserSearchSettings from "@/components/shared/User/UserSearchSettings";


async function fetchData(uid: string) {
    return await fetch(`http://localhost:3000/api/get-user-data?uid=${uid}`)
        .then((res) => res.json())
        .then((data) => {
            return data as IUserFull
        })
}

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
        queryFn: () => fetchData(uid),
        enabled: !!uid,
        staleTime: 5 * 60 * 1000,
    });

    return (
        <div className={`px-4`}>
            <UserMainInfo data={data} isLoading={isLoading}/>
            <UserButtons/>
            <UserSearchSettings data={data} isLoading={isLoading}/>
        </div>
    );
};

export default Page;