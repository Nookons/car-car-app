import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const uid = searchParams.get("uid");
        const page = parseInt(searchParams.get("page") || "1", 10);
        const pageSize = 250;
        const offset = (page - 1) * pageSize;

        if (!uid) {
            return NextResponse.json({ error: "Invalid uid parameter" }, { status: 400 });
        }

        // Получаем данные юзера
        const userRes = await fetch(`https://car-car-app.vercel.app/api/get-user-data?uid=${uid}`);
        const user = await userRes.json();

        if (!user || !user.user_id) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const client = await pool.connect();

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
            ORDER BY distance_meters ASC
                LIMIT $11 OFFSET $12;
        `;

        const values = [
            user.lng,                 // $1
            user.lat,                 // $2
            user.brand,               // $3
            user.model,               // $4
            user.min_price,           // $5
            user.max_price,           // $6
            user.max_mileage,         // $7
            user.seller_types,        // $8
            user.platform_types,      // $9
            user.condition_types,     // $10
            pageSize,                 // $11
            offset                    // $12
        ];

        const res = await client.query(query, values);
        client.release();

        // Возвращаем массив объектов
        return NextResponse.json(res.rows);
    } catch (error) {
        console.error("Database query error:", error);
        return NextResponse.json({ error: "Failed to fetch cars" }, { status: 500 });
    }
}
