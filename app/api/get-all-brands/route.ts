import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // В переменной окружения
});

export async function GET(request: NextRequest) {
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT DISTINCT brand FROM public.cars');
        client.release();

        return NextResponse.json(res.rows);
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}


