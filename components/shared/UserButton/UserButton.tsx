import React from 'react';
import {Button} from "@/components/ComponentsProvider";
import {CircleUserRound} from "lucide-react";
import Link from "next/link";
import {useParams, useSearchParams} from "next/navigation";


const UserButton = () => {
    const searchParams = useSearchParams();
    const uid = searchParams.get('uid');
    const params = useParams();

    return (
        <Link href={`/${params.locale}/user/${uid}`}>
            <Button variant={`outline`}>
                <CircleUserRound />
            </Button>
        </Link>
    );
};

export default UserButton;