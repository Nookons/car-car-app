import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        const query = `
            SELECT
                MIN(production_year) AS min_year,
                MAX(production_year) AS max_year
            FROM cars;
        `;

        const res = await client.query(query);

        if (res.rows.length === 0 || res.rows[0].min_year === null) {
            return NextResponse.json({ error: 'No data found' }, { status: 404 });
        }

        return NextResponse.json({
            min_year: res.rows[0].min_year,
            max_year: res.rows[0].max_year
        });
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    } finally {
        client.release();
    }
}
