import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const brand = searchParams.get('brand');

        if (!brand) {
            return NextResponse.json({ error: 'Brand parameter is required' }, { status: 400 });
        }

        const client = await pool.connect();

        const query = `
            SELECT
                brand,
                string_agg(DISTINCT model, ', ') AS models
            FROM
                cars
            WHERE
                LOWER(brand) = LOWER($1)
            GROUP BY
                brand
            ORDER BY
                brand;
        `;

        const res = await client.query(query, [brand]);
        client.release();

        if (res.rows.length === 0) {
            return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
        }

        return NextResponse.json(res.rows[0]);
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
    }
}
