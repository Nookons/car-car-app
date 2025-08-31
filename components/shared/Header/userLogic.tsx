'use client'
import {useUserStore} from "@/store/user/userStore";
import {useEffect, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {getUserFavoriteListId} from "@/features/user/getUserFavoriteListId";

const UserLogic = () => {
    const user_store = useUserStore(state => state.user_data)
    const add_to_favorite = useUserStore(state => state.addToFavorite)

    const [uid, setUid] = useState<string | null>(null)

    const {data, isLoading, isError} = useQuery({
        queryKey: ['user_logic', uid],
        queryFn: () => getUserFavoriteListId(uid || ""),
        enabled: !!uid,
        staleTime: 5 * 60 * 1000
    })

    useEffect(() => {
        if (user_store.user_id !== 0) {
            setUid(user_store.user_id.toString())
        }
    }, [user_store])

    useEffect(() => {
        if (data && data.length > 0) {
            data.forEach(item => {
                add_to_favorite(item)
            })
        }
    }, [data])


    return null
};

export default UserLogic;