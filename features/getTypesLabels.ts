import {t} from "i18next";

export function getConditionLabel(type: string) {
    switch (type.toLowerCase()) {
        case "new":
            return t("new")
        case "used":
            return t("used")
        default:
            return ""
    }
}

export function getTransmissionTypeLabel(type: string) {
    switch (type.toLowerCase()) {
        case "part_time_4x4":
            return t("transmission_object.part_time_4x4")     // 4x4 (automatically engaged)
        case "full_time_4x4":
            return t("transmission_object.full_time_4x4")      // 4x4 (permanent)
        case "front_wheel_drive":
            return t("transmission_object.front_wheel_drive")  // front-wheel drive
        case "rear_wheel_drive":
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
        case "automatic":
            return t("gear_box_object.automatic")      // автоматическая коробка
        case "manual":
            return t("gear_box_object.manual")         // механическая коробка
        case "unknown":
            return t("gear_box_object.unknown")        // неизвестно
        default:
            return ""
    }
}

export function getBodyTypeLabel(type: string) {
    switch (type.toLowerCase()) {
        case "small_car":
            return t("body_type_object.small_car")
        case "hatchback":
            return t("body_type_object.hatchback")
        case "city_car":
            return t("body_type_object.city_car")
        case "coupe":
            return t("body_type_object.coupe")
        case "convertible":
            return t("body_type_object.convertible")
        case "station_wagon":
            return t("body_type_object.station_wagon")
        case "compact":
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
        case "petrol":
            return t("fuel_type_object.petrol")
        case "petrol_lpg":
            return t("fuel_type_object.petrol_lpg")
        case "diesel":
            return t("fuel_type_object.diesel")
        case "electric":
            return t("fuel_type_object.electric")
        case "hybrid":
            return t("fuel_type_object.hybrid")
        case "unknown":
            return t("fuel_type_object.unknown")
        default:
            return ""
    }
}

export function getColorLabel(type: string) {
    switch (type.toLowerCase()) {
        case "beige":
            return t("color_object.beige")
        case "white":
            return t("color_object.white")
        case "sky_blue":
            return t("color_object.sky_blue")
        case "burgundy":
            return t("color_object.burgundy")
        case "brown":
            return t("color_object.brown")
        case "black":
            return t("color_object.black")
        case "red":
            return t("color_object.red")
        case "purple":
            return t("color_object.purple")
        case "navy":
            return t("color_object.navy")
        case "other":
            return t("color_object.other")
        case "blue":
            return t("color_object.blue")
        case "orange":
            return t("color_object.orange")
        case "silver":
            return t("color_object.silver")
        case "gray":
            return t("color_object.gray")
        case "green":
            return t("color_object.green")
        case "gold":
            return t("color_object.gold")
        case "yellow":
            return t("color_object.yellow")
        case "unknown":
            return t("color_object.unknown")
        default:
            return ""
    }
}




