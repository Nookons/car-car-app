import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, carId } = body;

        if (!userId || !carId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const client = await pool.connect();

        try {
            const query = `
                INSERT INTO user_saw_ad (user_id, ad_id)
                VALUES ($1, $2)
                    ON CONFLICT (user_id, ad_id) DO NOTHING
                RETURNING user_id, ad_id, created_at;
            `;

            const values = [userId, carId];
            const result = await client.query(query, values);

            // Если запись добавлена, вернется строка. Если нет — будет пусто.
            if (result.rows.length === 0) {
                return NextResponse.json({ save: false }, { status: 200 });
            }

            return NextResponse.json({ save: true }, { status: 201 });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Database insert error:', error);
        return NextResponse.json({ save: false }, { status: 500 });
    }
}
