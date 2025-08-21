'use client';
import {useUserStore} from "@/store/user/userStore";
import {useEffect} from "react";
import {useQuery} from "@tanstack/react-query";
import {getListForUser} from "@/features/cars/getListForUser";

export default function Page() {
    const user_data = useUserStore(state => state.user_data)


    const {data, isLoading, isError, error} = useQuery<Any, Error>({
        queryKey: ['user', user_data.user_id],
        queryFn: () => getListForUser({ uid: user_data.user_id, pageNumber }),
        enabled: !!user_data.user_id !== 0,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        console.log(user_data.user_id);
        console.log(data);
    }, [data]);

    if (!user_data.id || user_data.id === 0) return null;

    return (
        <div className="p-2">
            {user_data.user_id}
        </div>
    );
}
