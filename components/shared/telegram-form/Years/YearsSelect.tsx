'use client';

import React, {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeftRight, LoaderCircle} from "lucide-react";
import {Input} from "@/components/ui/input";
import {getYears} from "@/features/getYears";
import {IYearResponse} from "@/types/Year";
import {useTelegramFormStore} from "@/store/telegram-form/TelegramForm";
import dayjs from "dayjs";
import {t} from "i18next";
import {useUserStore} from "@/store/user/userStore";


const YearsSelect = () => {
    const telegramData = useTelegramFormStore(state => state.data)
    const setMinYear = useTelegramFormStore(state => state.setMinYear)
    const setMaxYear = useTelegramFormStore(state => state.setMaxYear)

    const user_store = useUserStore(state => state.user_data)

    useEffect(() => {
        console.log(user_store);
        if (user_store) {
            if (user_store?.min_year) {
                setMinYear(user_store.min_year.toString())
            }
            if (user_store?.max_year) {
                setMaxYear(user_store.max_year.toString())
            }
        }
    }, [user_store.min_year, user_store.max_year]);

    const {data: IYearResponse = {model: '', min_year: 0, max_year: 0}, isLoading, isError} = useQuery<IYearResponse>({
        queryKey: ['years_range'],
        queryFn: () => getYears(),
        staleTime: 5 * 60 * 1000,
    });

    return (
        <div>
            <article className={`my-2 text-neutral-500 text-xs`}>{t("telegram_form.years_range")}</article>
            <div className="w-full grid grid-cols-[1fr_20px_1fr] items-center gap-4">
                <div className="relative">
                    <Input
                        type={"number"}
                        value={telegramData.minYear}
                        onChange={(event) => setMinYear(event.target.value)}
                        className="pr-10"
                        placeholder={isLoading ? 'Loading...' : `${dayjs(IYearResponse.min_year).format("YYYY")}`}
                    />
                    {isLoading && (
                        <div className="absolute top-1/2 right-3 -translate-y-1/2">
                            <LoaderCircle className="animate-spin text-gray-500"/>
                        </div>
                    )
                    }
                </div>
                <div>
                    <ArrowLeftRight size={14} />
                </div>
                <div className="relative">
                    <Input
                        type={"number"}
                        value={telegramData.maxYear}
                        onChange={(event) => setMaxYear(event.target.value)}
                        className="pr-10"
                        placeholder={
                            isLoading
                                ? 'Loading...'
                                : `${dayjs(IYearResponse.max_year).format("YYYY")}`
                        }
                    />
                    {isLoading && (
                        <div className="absolute top-1/2 right-3 -translate-y-1/2">
                            <LoaderCircle className="animate-spin text-gray-500"/>
                        </div>
                    )
                    }
                </div>
            </div>
        </div>
    );
};

export default YearsSelect;
