import React, {useEffect} from 'react';
import {Button, Skeleton} from "@/components/ComponentsProvider";
import {ICarAdd} from "@/types/Car";
import {useTranslation} from "react-i18next";
import {ExternalLink, HeartMinus, HeartPlus, Share2} from "lucide-react";
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

        addToFavoriteStore(data.id); // обновляем локальный стор

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

        removeFromFavoriteStore(data.id); // обновляем локальный стор

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
            addToFavoriteStore(data.id)
            toast.error(`${data?.title}`, {
                description: `${error?.message || error?.toString()}`,
            });
        }
    }

    const handleShare = () => {
        if (typeof navigator !== 'undefined' && navigator.share) {
            navigator.share({
                title: data?.title,
                text: 'Check out this car! On CarCar 🙈',
                url: window.location.href
            })
                .then(() => console.log('Shared successfully!'))
                .catch((err) => console.error('Sharing error:', err))
        } else {
            alert('Sharing is not supported on this device')
        }
    }



    if (isLoading) {
        return (
            <Skeleton className={`w-full h-50`}/>
        )
    }

    if (!data) return null;

    return (
        <div className={`grid grid-cols-[1fr_45px_45px] gap-2`}>
            <Link href={data.ad_link}><Button className={`w-full`}><ExternalLink /> {t('open_original')}</Button></Link>


            {!userData.favorite.includes(data.id)
                ? (<Button disabled={!userData && true} onClick={onAddToFavorite} variant={`outline`} className={`w-full`}><HeartPlus /> </Button>)
                : (<Button disabled={!userData && true} onClick={onRemoveFromFavorite} className={`w-full`}><HeartMinus /> </Button>)
            }
            <Button
                variant={`outline`}
                onClick={handleShare} // Web Share API или кастомная логика
            >
                <Share2 className="w-5 h-5" />
            </Button>
        </div>
    );
};

export default AdButtons;