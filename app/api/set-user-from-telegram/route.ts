import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, first_name, last_name, username, language_code } = body;

        if (!id || !first_name || !username) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const client = await pool.connect();

        try {
            const query = `
                INSERT INTO users (id, first_name, last_name, username, language_code)
                VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO NOTHING
                RETURNING id, first_name, last_name, username, language_code;
            `;

            const values = [
                id,
                first_name.trim(),
                last_name?.trim() || null,
                username.trim().toLowerCase(),
                language_code || 'en',
            ];

            const result = await client.query(query, values);

            return NextResponse.json({ user: result.rows[0] }, { status: 201 });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Database insert error:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}
