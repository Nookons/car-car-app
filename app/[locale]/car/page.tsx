import React from "react";
import CarList from "@/components/shared/CarList/CarList";

export default function Page() {


    return (
        <div className="p-2 max-w-full flex flex-col gap-2">
            <CarList />
        </div>
    );
}
