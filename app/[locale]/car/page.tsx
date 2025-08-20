'use client';
import {useUserStore} from "@/store/user/userStore";
import {useEffect} from "react";

export default function Page() {
    const user_data = useUserStore(state => state.user_data)

    useEffect(() => {
        console.log(user_data);
    }, [user_data]);

    return (
        <div className="p-2">
           cars
        </div>
    );
}
