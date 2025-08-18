import React from 'react';
import Link from "next/link";
import {Checkbox} from "@/components/ComponentsProvider";
import {t} from "i18next";

interface Props {
    value: boolean;
    onChange: (value: boolean) => void;
}

const ConditionCheckBox: React.FC <Props> = ({value, onChange}) => {
    return (
        <div className="flex items-center gap-3">
            <div className={`py-2`}>
                <Checkbox checked={value} onCheckedChange={(e: boolean) => onChange(e)} />
            </div>
            <div className="grid gap-2">
                <p className="text-muted-foreground text-xs">
                    {t(`telegram_form.privacy_label`)} <Link className={`text-primary font-semibold`} href={`/en/privacy`}>{t(`telegram_form.privacy_button`)}</Link>
                </p>
            </div>
        </div>
    );
};

export default ConditionCheckBox;