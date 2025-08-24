import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
    const client = await pool.connect();

    try {
        // Читаем JSON из тела запроса
        const body = await request.json();
        const { user_id, car_id } = body;

        if (!user_id || !car_id) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        // Вызов функции PostgreSQL
        const query = `SELECT add_to_favorite($1::BIGINT, $2::BIGINT);`;
        await client.query(query, [user_id, car_id]); // оставляем как строки

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Failed to add favorite" }, { status: 500 });
    } finally {
        client.release();
    }
}
