'use client';
import {useUserStore} from "@/store/user/userStore";
import {useEffect} from "react";
import CarList from "@/components/shared/CarList/CarList";

export default function Page() {
    const user_data = useUserStore(state => state.user_data)

    useEffect(() => {
        if (user_data.id) {
            const fetchUserSettings = async (uid: string) => {
                fetch(`http://localhost:3000/api/get-user-data?uid=${uid}`)
                    .then(res => res.json())
                    .then(data => {
                        console.log(data)
                    })
            }

            fetchUserSettings(user_data.id.toString());
        }

    }, [user_data]);

    useEffect(() => {
        console.log(user_data.id.toString());
    }, [user_data]);

    if (!user_data.id || user_data.id === 0) return null;

    return (
        <div className="p-2">
            <CarList uid={user_data.id.toString()} />
        </div>
    );
}
