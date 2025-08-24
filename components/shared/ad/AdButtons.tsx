import React, {useEffect} from 'react';
import {Button, Skeleton} from "@/components/ComponentsProvider";
import {ICarAdd} from "@/types/Car";
import {useTranslation} from "react-i18next";
import {ExternalLink, HeartMinus, HeartPlus} from "lucide-react";
import Link from "next/link";
import {toast} from "sonner";
import dayjs from "dayjs";
import {useSearchParams} from "next/navigation";
import {useUserStore} from "@/store/user/userStore";
import {addToFavorite} from "@/features/user/addToFavorite";
import {removeFromFavorite} from "@/features/user/removeFromFavorite";

interface Props {
    data: ICarAdd | undefined;
    isLoading: boolean;
}

const AdButtons: React.FC<Props> = ({data, isLoading}) => {
    const { t } = useTranslation();

    const user_store = useUserStore(state => state.user_data)

    const userData = useUserStore(state => state.data)
    const addToFavoriteStore = useUserStore(state => state.addToFavorite)
    const removeFromFavoriteStore = useUserStore(state => state.removeFromFavorite)


    const onAddToFavorite = async () => {
        if (!data) return

        addToFavoriteStore(Number(data.id)); // обновляем локальный стор

        const adIdStr = data.id.toString();
        const userIdStr = user_store.user_id.toString();

        try {
            await addToFavorite({ user_id: userIdStr, ad_id: adIdStr });

            toast.success(`${data?.title}`, {
                description: `Successfully added on ${dayjs().format(
                    'dddd, MMMM DD, YYYY [at] HH:mm'
                )}`,
            });
        } catch (error: any) {
            removeFromFavoriteStore(Number(data.id))
            toast.error(`${data?.title}`, {
                description: `Failed to add to favorite. Please try again. ${
                    error?.message || error?.toString()
                }`,
            });
        }
    }

    const onRemoveFromFavorite = async () => {
        if (!data) return

        removeFromFavoriteStore(Number(data.id)); // обновляем локальный стор

        const adIdStr = data.id.toString();
        const userIdStr = user_store.user_id.toString();

        try {
            await removeFromFavorite({ user_id: userIdStr, ad_id: adIdStr });

            toast.success(`${data?.title}`, {
                description: `Successfully removed on ${dayjs().format(
                    'dddd, MMMM DD, YYYY [at] HH:mm'
                )}`,
            });
        } catch (error: any) {
            addToFavoriteStore(Number(data.id))
            toast.error(`${data?.title}`, {
                description: `${error?.message || error?.toString()}`,
            });
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


            {!userData.favorite.includes(Number(data.id))
                ? (<Button disabled={!userData && true} onClick={onAddToFavorite} variant={`outline`} className={`w-full`}><HeartPlus /> {t('favorite')}</Button>)
                : (<Button disabled={!userData && true} onClick={onRemoveFromFavorite} className={`w-full`}><HeartMinus /> {t('favorite')}</Button>)
            }
        </div>
    );
};

export default AdButtons;