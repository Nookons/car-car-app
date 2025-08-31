'use client';

import React, {Suspense} from 'react';
import LanguageSelect from "@/components/shared/LanuageSelect/LanguageSelect";
import {ModeToggle} from "@/components/shared/ModeToggle/ModeToggle";
import UserButton from "@/components/shared/UserButton/UserButton";
import {useRouter} from "next/navigation";
import {ChevronLeft, CircleChevronLeft, MoveLeft} from "lucide-react";
import {Button} from "@/components/ComponentsProvider";
import UserLogic from "@/components/shared/Header/userLogic";


const Header = () => {
    const router = useRouter();

    return (
        <div
            className="w-full relative items-center pt-15 grad h-full top-0 left-0 bg-gradient-to-b from-primary/65 via-background to-background "
        >
            <UserLogic />
            <div className={`grid grid-cols-2`}>
                <div className={`col-span-2 text-center`}>
                    <h1 className="font-bold text-xl text-primary">CarCar</h1>
                </div>
                <div className={`px-4 w-full pt-6 col-span-2 flex justify-between`}>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => router.back()} variant={`outline`} size={`icon`}>
                            <ChevronLeft />
                        </Button>

                        <ModeToggle/>
                    </div>
                    <div className={`flex items-center gap-2`}>
                        <LanguageSelect/>
                        <Suspense fallback={<div>Loading user...</div>}>
                            <UserButton/>
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Header;
