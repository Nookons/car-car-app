import React from 'react';
import {IUserFull} from "@/types/User";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ComponentsProvider";

const UserMainInfo = ({data, isLoading}: {data: IUserFull | null | undefined, isLoading: boolean}) => {

    if (isLoading) return null;

    if (!data) return null;

    return (
        <div className={`w-full flex flex-wrap items-center gap-4 py-4`}>
            <Avatar className={`size-[85px]`}>
                <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            <div>
                <p className={`font-bold text-xl`}>{data.first_name || ""} {data.last_name || ""}</p>
                <p className={`text-neutral-500`}>{data.username}</p>
            </div>
        </div>
    );
};

export default UserMainInfo;