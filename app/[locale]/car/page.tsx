'use client';
import {useUserStore} from "@/store/user/userStore";

export default function Page() {
    const user_data = useUserStore(state => state.user_data)


    return (
        <div className="p-2">
            {user_data.user_id}
        </div>
    );
}
