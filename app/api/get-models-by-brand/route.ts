import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const brandParam = searchParams.get('brand');

        if (!brandParam) {
            return NextResponse.json({ error: 'Brand parameter is required' }, { status: 400 });
        }

        const brands = brandParam
            .split(',')
            .map((b) => b.trim().toLowerCase())
            .filter(Boolean);

        if (brands.length === 0) {
            return NextResponse.json({ error: 'At least one brand must be provided' }, { status: 400 });
        }

        const client = await pool.connect();

        const query = `
            SELECT
                b.brand AS brand,
                array_agg(DISTINCT m.model) AS models
            FROM
                brands_list b
                    JOIN
                models_list m ON m.brand_id = b.id
            WHERE
                LOWER(b.brand) = ANY($1)
            GROUP BY
                b.brand
            ORDER BY
                b.brand;
        `;

        const res = await client.query(query, [brands]);
        client.release();

        if (res.rows.length === 0) {
            return NextResponse.json({ error: 'No models found for the given brands' }, { status: 404 });
        }

        console.log(res.rows)
        return NextResponse.json(res.rows);
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
    }
}
