import {NextRequest, NextResponse} from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        const { searchParams } = new URL(request.url);
        const uid = searchParams.get('uid')?.trim().toLowerCase();

        if (!uid) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const query = `
            SELECT
                user_search_settings.*,
                users.*
            FROM user_search_settings
                     JOIN users ON user_search_settings.user_id = users.id
            WHERE user_search_settings.user_id = $1
        `;

        const res = await client.query(query, [uid]);

        if (res.rows.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(res.rows[0], { status: 200 });
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    } finally {
        client.release();
    }
}