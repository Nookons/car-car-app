import React from 'react';
import Link from "next/link";
import {Checkbox} from "@/components/ComponentsProvider";

interface Props {
    value: boolean;
    onChange: (value: boolean) => void;
}

const ConditionCheckBox: React.FC <Props> = ({value, onChange}) => {
    return (
        <div className="flex items-start gap-3">
            <div className={``}>
                <Checkbox checked={value} onCheckedChange={(e: boolean) => onChange(e)} />
            </div>
            <div className="grid gap-2">
                <p className="text-muted-foreground text-xs">
                    By clicking this checkbox, you agree to the <Link className={`text-primary font-semibold`} href={`/`}>Terms and conditions</Link>.
                </p>
            </div>
        </div>
    );
};

export default ConditionCheckBox;