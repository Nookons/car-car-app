import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const uid = searchParams.get("uid");
        const page = parseInt(searchParams.get("page") || "1");
        const pageSize = 50;
        const offset = (page - 1) * pageSize;

        if (!uid) {
            return NextResponse.json({ error: "Invalid uid parameter" }, { status: 400 });
        }

        const client = await pool.connect();

        // 1. достаём настройки пользователя
        const userRes = await client.query(
            `SELECT * FROM user_search_settings WHERE user_id = $1 LIMIT 1`,
            [Number(uid)]
        );

        if (userRes.rows.length === 0) {
            client.release();
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const user = userRes.rows[0];

        // 2. достаём объявления
        const query = `
            SELECT *
            FROM cars c
            WHERE c.price BETWEEN $1 AND $2
              AND ($3::text[] IS NULL OR c.brand = ANY($3::text[]))
              AND ($4::text[] IS NULL OR c.model = ANY($4::text[]))
              AND ($5::int IS NULL OR EXTRACT(YEAR FROM c.year) >= $5::int)
              AND ($6::int IS NULL OR EXTRACT(YEAR FROM c.year) <= $6::int)
              AND ($7::int IS NULL OR c.mileage <= $7::int)
              AND ($8::text[] IS NULL OR c.seller_type = ANY($8::text[]))
              AND ($9::text[] IS NULL OR c.platform = ANY($9::text[]))
              AND ($10::text[] IS NULL OR c.new_used = ANY($10::text[]))
              AND ($11 = 0 OR ST_DWithin(
                    c.geom::geography,
                    ST_SetSRID(ST_MakePoint($12, $13), 4326)::geography,
                    $11 * 1000
                              ))
            ORDER BY c.created_at DESC
                LIMIT $14 OFFSET $15;
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
            user.from_user_range,
            user.lng,
            user.lat,
            pageSize,
            offset
        ];

        const carsRes = await client.query(query, values);

        client.release();

        return NextResponse.json(carsRes.rows, { status: 200 });
    } catch (error) {
        console.error("Database query error:", error);
        return NextResponse.json({ error: "Failed to fetch cars" }, { status: 500 });
    }
}
