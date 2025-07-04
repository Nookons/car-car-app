import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const model = searchParams.get('model');

        if (!model) {
            return NextResponse.json({ error: 'Brand parameter is required' }, { status: 400 });
        }

        const client = await pool.connect();

        const query = `
            SELECT
                model,
                MIN(price) AS min_price,
                MAX(price) AS max_price
            FROM
                cars
            WHERE
                LOWER(model) = LOWER($1)
            GROUP BY
                model
            ORDER BY
                model;
        `;

        const res = await client.query(query, [model]);
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
