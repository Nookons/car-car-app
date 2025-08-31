import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const uid = searchParams.get('uid');

        if (!uid) {
            return NextResponse.json({ error: 'Invalid uid parameter' }, { status: 400 });
        }

        const client = await pool.connect();

        const res = await client.query(`
            SELECT COALESCE(array_agg(car_id), '{}') AS car_ids
            FROM users_favorite
            WHERE user_id = $1;
        `, [uid]);

        client.release();

        return NextResponse.json(res.rows[0].car_ids);
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch cars' }, { status: 500 });
    }
}
