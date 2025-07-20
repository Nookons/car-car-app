import {NextRequest, NextResponse} from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const client = await pool.connect();

        const res = await client.query(`
            SELECT *
            FROM public.cars
                     LIMIT 100;
        `);


        client.release();

        return NextResponse.json(res.rows);
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch cars' }, { status: 500 });
    }
}