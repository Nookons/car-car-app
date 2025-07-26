import pool from '@/lib/db';
import {NextRequest, NextResponse} from 'next/server';

export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        const query = `
            SELECT MIN(price) AS min_price,
                   MAX(price) AS max_price
            FROM cars;
        `;

        const res = await client.query(query);
        return NextResponse.json(res.rows[0]);

    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({error: 'Failed to fetch data'}, {status: 500});
    } finally {
        client.release();
    }
}
