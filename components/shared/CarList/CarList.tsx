'use client';
import React, { useEffect, useState } from 'react';
import {useRouter} from "next/navigation";
import {getListForUser} from "@/features/cars/getListForUser";
import {useQuery} from "@tanstack/react-query";
import {IUserFull} from "@/types/User";
import {useUserStore} from "@/store/user/userStore";


const CarList = () => {
    const router = useRouter();
    const [pageNumber, setPageNumber] = useState(1);

    const user = useUserStore(state => state.user_data)

    useEffect(() => {
        console.log(user);
    }, [user]);

    const {data, isLoading, isError, error} = useQuery<IUserFull, Error>({
        queryKey: ['user', user.id],
        queryFn: () => getListForUser({ uid: user.id, pageNumber }),
        enabled: !!user.id,
        staleTime: 5 * 60 * 1000,
    });


    return (
        <div className="flex flex-col items-center gap-4">

        </div>
    );
};

export default CarList;
