import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';


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


