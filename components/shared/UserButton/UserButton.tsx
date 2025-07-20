import React from 'react';
import {Button} from "@/components/ui/button";
import {CircleUser} from "lucide-react";
import Link from "next/link";
import {IUserFull} from "@/types/UserTypes";
import {useQuery} from "@tanstack/react-query";
import {error} from "next/dist/build/output/log";
import {Skeleton} from "@/components/ui/skeleton";

interface Props {
    uid: string | null;
}

async function fetchData(uid: string) {
    return await fetch(`https://car-car-app.vercel.app/api/get-user-data?uid=${uid}`)
        .then((res) => res.json())
        .then((data) => {
            return data as IUserFull
        })
}

const UserButton: React.FC<Props> = ({uid}) => {
    if (!uid) return null;

    const {data, isLoading, isError} = useQuery<IUserFull | null>({
        queryKey: [uid],
        queryFn: () => fetchData(uid),
        staleTime: 5 * 60 * 1000,
    });

    if (isLoading) {
        return (
            <Skeleton  className={`w-30 h-8 animate-pulse`} />
        )
    }

    if (!data || isError) return null;

    return (
        <Link href={`/user/${uid}`}>
            <Button variant={`outline`} className={``}>
                <CircleUser /> {data.username}
            </Button>
        </Link>
    );
};

export default UserButton;