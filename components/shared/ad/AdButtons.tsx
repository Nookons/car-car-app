import React from 'react';
import {Button, Skeleton} from "@/components/ComponentsProvider";
import {ICarAdd} from "@/types/Car";
import {useTranslation} from "react-i18next";
import {ExternalLink, HeartMinus, HeartPlus} from "lucide-react";
import Link from "next/link";
import {toast} from "sonner";
import dayjs from "dayjs";
import {useSearchParams} from "next/navigation";
import {useUserStore} from "@/store/user/userStore";

interface Props {
    data: ICarAdd | undefined;
    isLoading: boolean;
}

const AdButtons: React.FC<Props> = ({data, isLoading}) => {
    const searchParams = useSearchParams();
    const uid = searchParams.get('uid');
    const { t } = useTranslation();

    const userData = useUserStore(state => state.data)
    const addToFavoriteStore = useUserStore(state => state.addToFavorite)
    const removeFromFavoriteStore = useUserStore(state => state.removeFromFavorite)

    const favoriteHandler = (type: 'add' | 'remove') => {
        if (!uid) {
            toast.error(`${data?.title}`, {
                description: `
                 Can't find the user, you must been logged in.
            `,
            })
            return
        }

        if (!data) {
            toast.error(`Error`, {
                description: `
                 Can't find the user, you must been logged in.
            `,
            })
            return
        }

        if (type === "add") {
            addToFavoriteStore(data.id)

            toast.success(`${data?.title}`, {
                description: `
                 Success Add ${dayjs().format("dddd, MMMM DD, YYYY [at] HH:mm")}
            `,
            })
        } else {
            removeFromFavoriteStore(data.id)

            toast.message(`${data?.title}`, {
                description: `
                 Success Remove ${dayjs().format("dddd, MMMM DD, YYYY [at] HH:mm")}
            `,
            })
        }
    }

    if (isLoading) {
        return (
            <Skeleton className={`w-full h-50`}/>
        )
    }

    if (!data) return null;

    return (
        <div className={`grid grid-cols-[1fr_125px] gap-2`}>
            <Link href={data.ad_link}><Button className={`w-full`}><ExternalLink /> {t('open_original')}</Button></Link>

            {!userData.favorite.includes(data.id)
                ? (<Button onClick={() => favoriteHandler('add')} variant={`outline`} className={`w-full`}><HeartPlus /> {t('favorite')}</Button>)
                : (<Button onClick={() => favoriteHandler('remove')} className={`w-full`}><HeartMinus /> {t('favorite')}</Button>)
            }
        </div>
    );
};

export default AdButtons;