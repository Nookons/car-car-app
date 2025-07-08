import pool from '@/lib/db';
import {NextRequest, NextResponse} from 'next/server';

export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        const query = `
            SELECT * FROM public.users
        `;

        const res = await client.query(query);

        if (res.rows.length === 0) {
            return NextResponse.json({error: `Users list not found`}, {status: 404});
        }

        return NextResponse.json(res.rows, {status: 200});
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({error: 'Failed to fetch data'}, {status: 500});
    } finally {
        client.release();
    }
}
