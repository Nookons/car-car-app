import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            id,
            search_brand,
            search_model,
            search_from_year,
            search_to_year,
            search_from_price,
            search_to_price
        } = body;

        if (id === 'none') {
            return NextResponse.json({ error: `User id is none` }, { status: 404 });
        }

        const client = await pool.connect();

        try {
            const query = `
                UPDATE users
                SET
                    search_brand = $2,
                    search_model = $3,
                    search_from_year = $4,
                    search_to_year = $5,
                    search_from_price = $6,
                    search_to_price = $7
                WHERE id = $1
                    RETURNING id, search_brand, search_model, search_from_year, search_to_year, search_from_price, search_to_price;
            `;

            const values = [
                id,
                search_brand?.toLowerCase() || '',
                search_model?.toLowerCase() || '',
                search_from_year?.toLowerCase() || '',
                search_to_year?.toLowerCase() || '',
                search_from_price || 0,
                search_to_price || 0
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
