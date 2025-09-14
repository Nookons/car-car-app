import {IUserFull} from "@/types/User";

export async function getUserByUID(uid: string) {
    const base_url = process.env.NEXT_PUBLIC_BASE_URL;

    return await fetch(`${base_url}api/user/get-user-by-id?uid=${uid}`)
        .then((res) => res.json())
        .then((data) => {
            return data as IUserFull
        })
}