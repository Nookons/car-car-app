import { NextRequest, NextResponse } from "next/server";
import dayjs from "dayjs";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
        const car = await request.json();
        const {
            lat, lng, price, year, mileage, brand, model,
            seller_type, platform_type, condition_type
        } = car;

        // Parse and validate input parameters
        const parsedLat = typeof lat === "string" ? parseFloat(lat) : lat;
        const parsedLng = typeof lng === "string" ? parseFloat(lng) : lng;
        const parsedPrice = price ? Number(price) : null;
        const parsedYear = year ? Number(dayjs(year).format("YYYY")) : null;
        const parsedMileage = mileage ? Number(mileage) : null;
        const parsedBrand = brand ? brand.toLowerCase() : null;
        const parsedModel = model ? model.toLowerCase() : null;
        const parsedSellerType = seller_type ? seller_type.toLowerCase() : null;
        const parsedPlatformType = platform_type ? platform_type.toLowerCase() : null;
        const parsedConditionType = condition_type ? condition_type.toLowerCase() : null;

        // Validate coordinates
        if (isNaN(parsedLat) || isNaN(parsedLng)) {
            return NextResponse.json(
                { error: "Invalid coordinates provided" },
                { status: 400 }
            );
        }

        const query = `
            SELECT
                uss.*,
                u.language_code,
                u.username,
                ST_Distance(
                        ST_SetSRID(ST_MakePoint(uss.lng, uss.lat), 4326)::geography,
                        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                ) AS distance_meters
            FROM
                user_search_settings uss
            JOIN
                users u ON u.id = uss.user_id
            WHERE
                (uss.brand IS NULL OR $3::text IS NULL OR $3 = ANY(LOWER(uss.brand::text)::text[]))
              AND
                (uss.model IS NULL OR $4::text IS NULL OR $4 = ANY(LOWER(uss.model::text)::text[]))
              AND
                (uss.min_price IS NULL OR $5::numeric IS NULL OR $5 >= uss.min_price)
              AND
                (uss.max_price IS NULL OR $5::numeric IS NULL OR $5 <= uss.max_price)
              AND
                (uss.min_year IS NULL OR $6::integer IS NULL OR $6 >= uss.min_year)
              AND
                (uss.max_year IS NULL OR $6::integer IS NULL OR $6 <= uss.max_year)
              AND
                (uss.max_mileage IS NULL OR $7::numeric IS NULL OR $7 <= uss.max_mileage)
              AND
                (uss.seller_types IS NULL OR $8::text IS NULL OR $8 = ANY(LOWER(uss.seller_types::text)::text[]))
              AND
                (uss.platform_types IS NULL OR $9::text IS NULL OR $9 = ANY(LOWER(uss.platform_types::text)::text[]))
              AND
                (uss.condition_types IS NULL OR $10::text IS NULL OR $10 = ANY(LOWER(uss.condition_types::text)::text[]))
              AND ST_DWithin(
                    uss.location::geography,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                    COALESCE(uss.from_user_range, 250) * 1000
                  )
            ORDER BY
                distance_meters ASC;
        `;

        const values = [
            parsedLng, parsedLat,              // $1, $2 - coordinates
            parsedBrand, parsedModel,          // $3, $4 - brand/model
            parsedPrice,                       // $5 - price
            parsedYear,                        // $6 - year
            parsedMileage,                     // $7 - mileage
            parsedSellerType,                  // $8 - seller type
            parsedPlatformType,                // $9 - platform type
            parsedConditionType                // $10 - condition type
        ];

        const result = await pool.query(query, values);

        console.log(result.rows);

        return NextResponse.json(
            { message: "success", users: result.rows },
            { status: 200 }
        );

    } catch (err: any) {
        console.error("Internal server error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}