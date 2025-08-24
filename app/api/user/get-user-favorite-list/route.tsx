import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
    const client = await pool.connect();

    try {
        const body = await request.json();
        const { user_id } = body;

        if (!user_id) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        const userId = Number(user_id);
        if (isNaN(userId)) {
            return NextResponse.json({ error: "Invalid user_id" }, { status: 400 });
        }

        // Простой запрос к таблице без функции
        const query = `
            SELECT *
            FROM users_favorite
            WHERE user_id = $1
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);

        return NextResponse.json({ success: true, data: res.rows }, { status: 200 });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
    } finally {
        client.release();
    }
}
