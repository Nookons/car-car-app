import {t} from "i18next";

export function getConditionLabel(type: string) {
    switch (type.toLowerCase()) {
        case "nowy":
            return t("new")
        case "używany":
            return t("used")
        default:
            return ""
    }
}

export function getTransmissionTypeLabel(type: string) {
    switch (type.toLowerCase()) {
        case "4x4 (dołączany automatycznie)":
            return t("transmission_object.part_time_4x4")     // 4x4 (automatically engaged)
        case "4x4 (stały)":
            return t("transmission_object.full_time_4x4")      // 4x4 (permanent)
        case "na przednie koła":
            return t("transmission_object.front_wheel_drive")  // front-wheel drive
        case "na tylne koła":
            return t("transmission_object.rear_wheel_drive")   // rear-wheel drive
        case "unknown":
            return t("transmission_object.unknown")            // unknown
        default:
            return ""
    }
}

export function getSellerTypeLabel(type: string) {
    switch (type.toLowerCase()) {
        case "firma":
            return t("firma")
        case "autoryzowany dealer":
            return t("dealer")
        case "osoba prywatna":
            return t("private_person")
        default:
            return ""
    }
}

export function getGearBoxLabelType(type: string) {
    switch (type.toLowerCase()) {
        case "automatyczna":
            return t("gear_box_object.automatic")      // автоматическая коробка
        case "manualna":
            return t("gear_box_object.manual")         // механическая коробка
        case "unknown":
            return t("gear_box_object.unknown")        // неизвестно
        default:
            return ""
    }
}

export function getBodyTypeLabel(type: string) {
    switch (type.toLowerCase()) {
        case "auta małe":
            return t("body_type_object.small_car")
        case "auta miejskie":
            return t("body_type_object.city_car")
        case "coupe":
            return t("body_type_object.coupe")
        case "kabriolet":
            return t("body_type_object.convertible")
        case "kombi":
            return t("body_type_object.station_wagon")
        case "kompakt":
            return t("body_type_object.compact")
        case "minivan":
            return t("body_type_object.minivan")
        case "sedan":
            return t("body_type_object.sedan")
        case "suv":
            return t("body_type_object.suv")
        case "unknown":
            return t("body_type_object.unknown")
        default:
            return ""
    }
}

export function getFuelTypeLabel(type: string) {
    switch (type.toLowerCase()) {
        case "benzyna":
            return t("fuel_type_object.petrol")
        case "benzyna+lpg":
            return t("fuel_type_object.petrol_lpg")
        case "diesel":
            return t("fuel_type_object.diesel")
        case "elektryczny":
            return t("fuel_type_object.electric")
        case "hybryda":
            return t("fuel_type_object.hybrid")
        case "unknown":
            return t("fuel_type_object.unknown")
        default:
            return ""
    }
}

export function getColorLabel(type: string) {
    switch (type.toLowerCase()) {
        case "beżowy":
            return t("color_object.beige")
        case "biały":
            return t("color_object.white")
        case "błękitny":
            return t("color_object.sky_blue")
        case "bordowy":
            return t("color_object.burgundy")
        case "brązowy":
            return t("color_object.brown")
        case "czarny":
            return t("color_object.black")
        case "czerwony":
            return t("color_object.red")
        case "fioletowy":
            return t("color_object.purple")
        case "granatowy":
            return t("color_object.navy")
        case "inny kolor":
            return t("color_object.other")
        case "niebieski":
            return t("color_object.blue")
        case "pomarańczowy":
            return t("color_object.orange")
        case "srebrny":
            return t("color_object.silver")
        case "szary":
            return t("color_object.gray")
        case "zielony":
            return t("color_object.green")
        case "złoty":
            return t("color_object.gold")
        case "żółty":
            return t("color_object.yellow")
        case "unknown":
            return t("color_object.unknown")
        default:
            return ""
    }
}




