import {NextRequest, NextResponse} from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('car_id');

        if (!id) {
            return NextResponse.json({ error: 'Invalid car_id parameter' }, { status: 400 });
        }

        const client = await pool.connect();

        const res = await client.query(`
            SELECT *
            FROM public.cars
            WHERE id = $1 ;
        `, [id]);

        client.release();

        return NextResponse.json(res.rows[0]);
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch cars' }, { status: 500 });
    }
}