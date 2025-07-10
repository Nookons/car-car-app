import {NextRequest, NextResponse} from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        const query = `
            SELECT
                user_search_settings.*,
                users.chat_id,
                users.language_code
            FROM user_search_settings
            JOIN users ON user_search_settings.user_id = users.id
        `;

        const res = await client.query(query);

        if (res.rows.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(res.rows, { status: 200 });
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    } finally {
        client.release();
    }
}