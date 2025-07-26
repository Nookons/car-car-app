import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const brandParam = searchParams.get('brand');

        if (!brandParam) {
            return NextResponse.json({ error: 'Brand parameter is required' }, { status: 400 });
        }

        // Разделение на массив и удаление пробелов
        const brands = brandParam.split(',').map((b) => b.trim().toLowerCase());

        if (brands.length === 0) {
            return NextResponse.json({ error: 'At least one brand must be provided' }, { status: 400 });
        }

        const client = await pool.connect();

        const query = `
            SELECT
                brand,
                string_agg(DISTINCT model, ', ') AS models
            FROM
                cars
            WHERE
                LOWER(brand) = ANY($1)
            GROUP BY
                brand
            ORDER BY
                brand;
        `;

        const res = await client.query(query, [brands]);
        client.release();

        if (res.rows.length === 0) {
            return NextResponse.json({ error: 'No models found for the given brands' }, { status: 404 });
        }

        return NextResponse.json(res.rows); // вернём массив объектов с brand и models
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
    }
}
