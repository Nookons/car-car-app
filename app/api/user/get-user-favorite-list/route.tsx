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
            SELECT a.*
            FROM users_favorite uf
                     JOIN cars a ON uf.car_id = a.id
            WHERE uf.user_id = $1
            ORDER BY uf.created_at DESC;
        `, [uid]);

        client.release();

        return NextResponse.json(res.rows);
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch cars' }, { status: 500 });
    }
}
