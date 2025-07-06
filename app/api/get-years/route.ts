import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        const { searchParams } = new URL(request.url);
        const brand = searchParams.get('brand')?.trim().toLowerCase() || null;
        const model = searchParams.get('model')?.trim().toLowerCase() || null;

        if (brand && !model) {
            const query = `
                SELECT
                    brand,
                    MIN(production_year) AS min_year,
                    MAX(production_year) AS max_year
                FROM cars
                WHERE LOWER(brand) = $1
                GROUP BY brand
                ORDER BY brand;
            `;

            const res = await client.query(query, [brand]);
            return NextResponse.json(res.rows[0]);
        }

        if (!brand && !model) {
            const query = `
                SELECT
                    MIN(production_year) AS min_year,
                    MAX(production_year) AS max_year
                FROM cars;
            `;

            const res = await client.query(query);
            return NextResponse.json(res.rows[0]);
        }

        if (model) {
            const query = `
                SELECT
                  model,
                  MIN(production_year) AS min_year,
                  MAX(production_year) AS max_year
                FROM cars
                WHERE LOWER(model) = $1
                GROUP BY model
                ORDER BY model;
            `;

            const res = await client.query(query, [model]);

            if (res.rows.length === 0) {
                return NextResponse.json({ error: `Model '${model}' not found` }, { status: 404 });
            }

            return NextResponse.json(res.rows[0]);
        }
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    } finally {
        client.release();
    }
}
