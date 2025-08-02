import dayjs from "dayjs";
import {t} from "i18next";

export const sendTelegramPhoto = async (user: any, car: any) => {
    const token = `7174600865:AAEA3SD8cDPdW-9J-RKVn82AeQhT4ceWNdI`
    const url = `https://api.telegram.org/bot${token}/sendPhoto`;


    if (!car.images || !Array.isArray(car.images) || car.images.length === 0) {
        console.warn(`⚠️ Нет фото для отправки пользователю ${user.user_id}`);
        return;
    }

    const getUserData = async () => {
        const res = await fetch(`http://localhost:3000/api/get-user-data?uid=${user.user_id}`);
        const data = await res.json();
        return data;
    };

    const userData = await getUserData();


    const escapeMarkdown = (text: string) => {
        return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
    };


    const labelPrice = escapeMarkdown(t("price", { lng: userData.language_code }));
    const labelBrand = escapeMarkdown(t("brand", { lng: userData.language_code }));
    const labelEngine = escapeMarkdown(t("engine", { lng: userData.language_code }));
    const labelProductionYear = escapeMarkdown(t("production_year", { lng: userData.language_code }));

    const sellerType = escapeMarkdown(t(car.seller_type.toLowerCase(), { lng: userData.language_code }));
    const fuelType = escapeMarkdown(t(`fuel_type_object.${car.fuel_type.toLowerCase()}`, { lng: userData.language_code }));

    const distance = user.distance_meters ? Number(Math.round(user.distance_meters / 1000).toFixed(0)) :  0;

    console.log(user);
    console.log(distance);

    const caption =
        `*${escapeMarkdown(car.title)}*\n\n` +
        `💵 *${escapeMarkdown(labelPrice)}:* ${escapeMarkdown(car.price ? car.price.toLocaleString() : "Не указана")} zl\n` +
        `🚗 *${escapeMarkdown(labelBrand)}:* ${escapeMarkdown(car.brand || "Не указано")} • ${escapeMarkdown(car.model || "Не указано")}\n` +
        `🧰 *${escapeMarkdown(labelEngine)}:* ${escapeMarkdown(car.engine_power || "—")} • ${escapeMarkdown(car.engine_capacity || "—")} • ${escapeMarkdown(fuelType || "—")}\n` +
        `📅 *${escapeMarkdown(labelProductionYear)}:* ${escapeMarkdown(car.year ? dayjs(car.year).format("YYYY") : "—")}\n\n` +
        `_${escapeMarkdown(`(${sellerType}) • ${dayjs(car.post_date).format("dddd, MMMM DD [at] HH:mm")}`)}_\n\n` +
        `_${escapeMarkdown(`${distance > 0 ? `${distance} km from you` : "🤏 Close to you"}`)}_\n` +
        `||[CarCar](https://t.me/carcarfinderbot)||`;



    try {
        const adUrl = `https://car-car-app.vercel.app/${userData.language_code || 'en'}/car/${car.id || ''}`;
        const mapUrl = car.map_url && car.map_url.startsWith('http') ? car.map_url : 'https://default-map-url.com';

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: user.user_id,
                photo: car.images[0].replace(/;s=\d+x\d+/, ";s=1000x1000"),
                caption,
                parse_mode: "MarkdownV2",
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: t("bot_buttons.open_ad", { lng: userData.language_code }), url: adUrl },
                            { text: t("bot_buttons.open_map", { lng: userData.language_code }), url: mapUrl },
                        ]
                    ]
                }
            }),
        });



        const data = await res.json();
        console.log(data);

        if (!data.ok) {
            console.error("Telegram API error:", data.description);
        }
    } catch (error) {
        console.error("Failed to send photo:", error);
    }
};
