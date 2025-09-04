'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ComponentsProvider';
import { useUserStore } from '@/store/user/userStore';
import Image from 'next/image';
import logo from 'public/ico/car-logo.svg';

const Footer = () => {
    const userStore = useUserStore(state => state.user_data);
    const language = userStore.language_code || 'en';

    return (
        <footer className="grid grid-cols-1 text-xs  md:grid-cols-[350px_1fr] pb-8 gap-2 justify-center items-center text-center max-w-[900px] mx-auto text-neutral-500">
            <div className="flex items-center gap-4 md:w-full justify-center">
                <Image src={logo} alt="CarCar Logo" width={45} height={45} priority />
                <p className="">
                    &copy; {new Date().getFullYear()} CarCar.
                </p>
            </div>
            <div className={``}>
                <Link href={`/${language}/privacy`}>
                    <Button variant="link">Terms</Button>
                </Link>
                <Link href={`/${language}/privacy`}>
                    <Button variant="link">Privacy</Button>
                </Link>
                <Link href={`/${language}/privacy`}>
                    <Button variant="link">Security</Button>
                </Link>
                <Link href={`/${language}/privacy`}>
                    <Button variant="link">Status</Button>
                </Link>
                <Link href={`/${language}/privacy`}>
                    <Button variant="link">Docs</Button>
                </Link>
                <Link href={`/${language}/privacy`}>
                    <Button variant="link">Contact</Button>
                </Link>
            </div>
        </footer>
    );
};

export default Footer;
