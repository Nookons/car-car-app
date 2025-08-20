import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const uid = searchParams.get("uid");
        const page = parseInt(searchParams.get("page") || "1"); // номер страницы
        const pageSize = 10000; // размер страницы
        const offset = (page - 1) * pageSize;

        if (!uid) {
            return NextResponse.json({ error: "Invalid uid parameter" }, { status: 400 });
        }

        // Получаем данные юзера по id
        const userRes = await fetch(`http://localhost:3000/api/get-user-data?uid=${uid}`);
        const user = await userRes.json();

        if (!user || !user.user_id) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const client = await pool.connect();

        // Запрос машин по фильтрам юзера с пагинацией
        const query = `
            SELECT *
            FROM cars c
            WHERE c.price BETWEEN $1 AND $2
              AND ($3::text IS NULL OR c.brand = $3)
              AND ($4::text IS NULL OR c.model = $4)
              AND ($5::int IS NULL OR EXTRACT(YEAR FROM c.year) >= $5::int)
              AND ($6::int IS NULL OR EXTRACT(YEAR FROM c.year) <= $6::int)
              AND ($7::int IS NULL OR c.mileage <= $7::int)
              AND (c.seller_type = ANY($8))
              AND (c.platform = ANY($9))
              AND (c.new_used = ANY($10))
              AND ST_DWithin(
                    c.geom::geography,
                    ST_SetSRID(ST_MakePoint($11, $12), 4326)::geography,
                    $13 * 1000
                  )
            ORDER BY c.created_at DESC
                LIMIT $14
            OFFSET $15
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
