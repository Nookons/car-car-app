'use client';
import {useUserStore} from "@/store/user/userStore";

export default function Page() {
    const user_data = useUserStore(state => state.user_data)

    if (!user_data.id || user_data.id === 0) return null;

    return (
        <div className="p-2">
            {user_data.user_id}
        </div>
    );
}
