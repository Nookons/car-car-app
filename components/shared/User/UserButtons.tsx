import React from 'react';
import {ArrowBigLeftDash, HandHelping} from "lucide-react";
import { Button } from '@/components/ComponentsProvider';
import Link from "next/link";
import {t} from "i18next";

const UserButtons = () => {
    if (!t) return null;

    return (
        <div className={`grid grid-cols-[1fr_125px] gap-2`}>
            <Link href={`https://t.me/nookon`}><Button className={`w-full`}><HandHelping />{t('support_contact')}</Button></Link>
            <Button variant={`outline`} className={`w-full flex items-center gap-2`}><ArrowBigLeftDash /> <p>{t("back")}</p></Button>
        </div>
    );
};

export default UserButtons;