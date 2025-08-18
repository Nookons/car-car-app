import { NextRequest, NextResponse } from "next/server";
import dayjs from "dayjs";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
        const car = await request.json();
        const {
            lat, lng, price, year, mileage, brand, model,
            seller_type, platform, new_used
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
        const parsedPlatformType = platform ? platform.toLowerCase() : null;
        const parsedConditionType = new_used ? new_used.toLowerCase() : null;

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
                (uss.brand IS NULL OR LOWER($3) = ANY(SELECT LOWER(b) FROM unnest(uss.brand) b))
              AND
                (uss.model IS NULL OR LOWER($4) = ANY(SELECT LOWER(m) FROM unnest(uss.model) m))
              AND
                (uss.min_price IS NULL OR $5 >= uss.min_price)
              AND
                (uss.max_price IS NULL OR $5 <= uss.max_price)
              AND
                (uss.min_year IS NULL OR $6 >= uss.min_year)
              AND
                (uss.max_year IS NULL OR $6 <= uss.max_year)
              AND
                (uss.max_mileage IS NULL OR $7 <= uss.max_mileage)
              
              AND (uss.seller_types IS NULL OR $8::text IS NULL OR LOWER($8::text) = ANY(SELECT LOWER(s) FROM unnest(uss.seller_types) s))
              AND (uss.platform_types IS NULL OR $9::text IS NULL OR LOWER($9::text) = ANY(SELECT LOWER(p) FROM unnest(uss.platform_types) p))
              AND (uss.condition_types IS NULL OR $10::text IS NULL OR LOWER($10::text) = ANY(SELECT LOWER(c) FROM unnest(uss.condition_types) c))

              AND ST_DWithin(
                    uss.location::geography,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                    COALESCE(uss.from_user_range, 250) * 1000
                  )
            ORDER BY
                distance_meters ASC;
        `;

        const values = [
            parsedLng, parsedLat,       // $1, $2 - coordinates
            parsedBrand, parsedModel,   // $3, $4 - brand/model
            parsedPrice,                // $5 - price
            parsedYear,                 // $6 - year
            parsedMileage,              // $7 - mileage
            parsedSellerType,           // $8 - seller type
            parsedPlatformType,         // $9 - platform type
            parsedConditionType         // $10 - condition type
        ];

        console.log(values);

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