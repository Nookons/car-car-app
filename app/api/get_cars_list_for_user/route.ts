import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const uid = searchParams.get("uid");
        const page = parseInt(searchParams.get("page") || "1"); // номер страницы
        const pageSize = 20; // размер страницы
        const offset = (page - 1) * pageSize;

        if (!uid) {
            return NextResponse.json({ error: "Invalid uid parameter" }, { status: 400 });
        }

        // Получаем данные юзера по id
        const userRes = await fetch(`https://car-car-app.vercel.app/api/get-user-data?uid=${uid}`);
        const user = await userRes.json();

        if (!user || !user.user_id) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const client = await pool.connect();

        // Запрос машин по фильтрам юзера с пагинацией
        const query = `
            SELECT
                c.*,
                ST_Distance(
                        c.location::geography,
                        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                ) AS distance_meters
            FROM cars c
            WHERE
                (c.brand IS NULL OR EXISTS (SELECT 1 FROM unnest(c.brand) b WHERE LOWER(b) = LOWER($3)))
              AND
                (c.model IS NULL OR EXISTS (SELECT 1 FROM unnest(c.model) m WHERE LOWER(m) = LOWER($4)))
              AND
                (c.min_price IS NULL OR $5 >= c.min_price)
              AND
                (c.max_price IS NULL OR $5 <= c.max_price)
              AND
                (c.min_year IS NULL OR $6 >= c.min_year)
              AND
                (c.max_year IS NULL OR $6 <= c.max_year)
              AND
                (c.max_mileage IS NULL OR $7 <= c.max_mileage)
              AND
                (c.seller_types IS NULL OR $8 IS NULL OR EXISTS (SELECT 1 FROM unnest(c.seller_types) s WHERE LOWER(s) = LOWER($8)))
              AND
                (c.platform_types IS NULL OR $9 IS NULL OR EXISTS (SELECT 1 FROM unnest(c.platform_types) p WHERE LOWER(p) = LOWER($9)))
              AND
                (c.condition_types IS NULL OR $10 IS NULL OR EXISTS (SELECT 1 FROM unnest(c.condition_types) cond WHERE LOWER(cond) = LOWER($10)))
              AND
                ST_DWithin(
                        c.location::geography,
                        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                        COALESCE(c.from_user_range, 250) * 1000
                )
            ORDER BY distance_meters ASC;
        `;

        const values = [
            user.min_price,
            user.max_price,
            user.brand,
            user.model,
            user.min_year,
            user.max_year,
            user.max_mileage,
            user.seller_types,
            user.platform_types,
            user.condition_types,
            user.lng,
            user.lat,
            user.from_user_range,
            pageSize,
            offset
        ];

        const res = await client.query(query, values);

        client.release();

        return NextResponse.json(res.rows);
    } catch (error) {
        console.error("Database query error:", error);
        return NextResponse.json({ error: "Failed to fetch cars" }, { status: 500 });
    }
}
