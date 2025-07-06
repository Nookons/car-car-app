import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const user_id = searchParams.get('user_id');

        if (!user_id) {
            return NextResponse.json({ error: 'user_id parameter is required' }, { status: 400 });
        }

        const client = await pool.connect();

        const query = `
            SELECT search_brand, search_model, search_from_price, search_to_price, search_from_year, search_to_year FROM users
            WHERE id = $1
        `;

        const res = await client.query(query, [user_id]);
        client.release();

        if (res.rows.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(res.rows[0]);
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
    }
}
