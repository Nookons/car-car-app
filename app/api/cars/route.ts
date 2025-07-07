import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';



export async function GET(request: NextRequest) {
    try {
        const client = await pool.connect();
        const res = await client.query(`
                SELECT *
                FROM public.cars
                WHERE posted_time >= NOW() - INTERVAL '7 days'
                ORDER BY posted_time DESC;
        `);
        client.release();

        return NextResponse.json(res.rows);
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const json = await request.json();
        const { name, email } = json;

        const client = await pool.connect();
        const res = await client.query(
            'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
            [name, email]
        );
        client.release();

        return NextResponse.json({ user: res.rows[0] }, { status: 201 });
    } catch (error) {
        console.error('Database insert error:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}
