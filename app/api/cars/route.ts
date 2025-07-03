import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // В переменной окружения
});

export async function GET(request: NextRequest) {
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT * FROM cars LIMIT 20');
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
