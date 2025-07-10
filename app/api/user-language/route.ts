import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';


export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('user_id')?.trim();

        if (!id) {
            return NextResponse.json({ error: 'Missing user_id parameter' }, { status: 400 });
        }

        const query = `
            SELECT * FROM public.users
            WHERE id = $1
        `;

        const res = await client.query(query, [id]);

        if (res.rows.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            language: res.rows[0].language_code,
            updated_at: res.rows[0].updated_at,
            created_at: res.rows[0].created_at,
        }, { status: 200 });
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    } finally {
        client.release();
    }
}



export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            user_id,
            language_code,
        } = body;

        if (!user_id || user_id === 'none') {
            return NextResponse.json({ error: `User id is none` }, { status: 404 });
        }

        const client = await pool.connect();

        try {
            const checkQuery = 'SELECT id FROM users WHERE id = $1';
            const checkResult = await client.query(checkQuery, [user_id]);

            if ((checkResult?.rowCount ?? 0) > 0) {
                const updateQuery = `
                    UPDATE users SET
                        language_code = $2,
                        updated_at = NOW()
                    WHERE id = $1
                    RETURNING *;
                `;

                const updateValues = [
                    user_id,
                    language_code
                ];

                const result = await client.query(updateQuery, updateValues);
                return NextResponse.json({ settings: result.rows[0] }, { status: 200 });
            }
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to save user language' }, { status: 500 });
    }
}
