import React, { useState } from 'react';
import { Button, Skeleton } from "@/components/ComponentsProvider";
import { ICarAdd } from "@/types/Car";
import { useTranslation } from "react-i18next";
import {ExternalLink, HeartMinus, HeartPlus, LoaderCircle, Share2} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import dayjs from "dayjs";
import { useUserStore } from "@/store/user/userStore";
import { addToFavorite } from "@/features/user/addToFavorite";
import { removeFromFavorite } from "@/features/user/removeFromFavorite";
import { TelegramShareButton } from "react-share";

interface Props {
    data: ICarAdd | undefined;
    isLoading: boolean;
}

const AdButtons: React.FC<Props> = ({ data, isLoading }) => {
    const { t } = useTranslation();
    const user_store = useUserStore(state => state.user_data)
    const userData = useUserStore(state => state.data)
    const addToFavoriteStore = useUserStore(state => state.addToFavorite)
    const removeFromFavoriteStore = useUserStore(state => state.removeFromFavorite)

    // состояние загрузки кнопок избранного
    const [loadingFav, setLoadingFav] = useState(false)

    if (isLoading) return <Skeleton className="w-full h-50" />
    if (!data) return null

    const isFavorite = userData?.favorite?.includes(data.id)

    const handleFavorite = async () => {
        if (!data || !user_store) return

        setLoadingFav(true)

        try {
            if (!isFavorite) {
                addToFavoriteStore(data.id)
                await addToFavorite({ user_id: user_store.user_id.toString(), ad_id: data.id.toString() })
                toast.success(`${data.title}`, { description: `Added on ${dayjs().format('dddd, MMMM DD, YYYY [at] HH:mm')}` })
            } else {
                removeFromFavoriteStore(data.id)
                await removeFromFavorite({ user_id: user_store.user_id.toString(), ad_id: data.id.toString() })
                toast.success(`${data.title}`, { description: `Removed on ${dayjs().format('dddd, MMMM DD, YYYY [at] HH:mm')}` })
            }
        } catch (error: any) {
            // откат действий в сторе при ошибке
            if (!isFavorite) removeFromFavoriteStore(data.id)
            else addToFavoriteStore(data.id)
            toast.error(`${data.title}`, { description: `${error?.message || error?.toString()}` })
        } finally {
            setLoadingFav(false)
        }
    }

    const message = "Check out CarCar! This platform collects car listings for you."
    const carUrl = `https://car-car-app.vercel.app/${user_store?.language_code || "en"}/car/${data.id ?? ''}`

    return (
        <div className="grid grid-cols-[1fr_45px_45px] gap-2">
            <Link href={data.ad_link || "#"}>
                <Button className="w-full"><ExternalLink /> {t('open_original')}</Button>
            </Link>

            <Button
                disabled={!userData || loadingFav}
                onClick={handleFavorite}
                variant={isFavorite ? undefined : "outline"}
                className="w-full flex items-center justify-center"
            >
                {loadingFav ? <LoaderCircle className={`animate-spin`} /> : isFavorite ? <HeartMinus /> : <HeartPlus />}
            </Button>

            <TelegramShareButton title={message} url={carUrl}>
                <Button variant="outline">
                    <Share2 className="w-5 h-5" />
                </Button>
            </TelegramShareButton>
        </div>
    )
}

export default AdButtons;
