import React from 'react';
import {Button} from "@/components/ComponentsProvider";
import {useRouter} from "next/navigation";

const ErrorTemplate = (error: any) => {
    const router = useRouter();

    return (
        <div className={`p-2`}>
            <h1>Uppsss....</h1>
            <h2>It's looks like this car was solved</h2>
            <Button onClick={router.back}>Back</Button>
        </div>
    );
};

export default ErrorTemplate;