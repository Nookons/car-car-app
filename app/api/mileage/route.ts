import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        const { searchParams } = new URL(request.url);
        const brand = searchParams.get('brand')?.trim().toLowerCase() || null;
        const model = searchParams.get('model')?.trim().toLowerCase() || null;

        // Если есть brand, но нет model — вернуть данные по бренду
        if (brand && !model) {
            const query = `
                SELECT
                    brand,
                    MIN(mileage) AS min_mileage,
                    MAX(mileage) AS max_mileage
                FROM cars
                WHERE LOWER(brand) = $1
                GROUP BY brand
                ORDER BY brand;
            `;

            const res = await client.query(query, [brand]);

            if (res.rows.length === 0) {
                return NextResponse.json({ error: `Brand '${brand}' not found` }, { status: 404 });
            }

            const row = res.rows[0];
            return NextResponse.json({
                brand: row.brand,
                min_mileage: Number(row.min_mileage),
                max_mileage: Number(row.max_mileage),
            });
        }

        // Если нет ни brand, ни model — вернуть данные по всему каталогу
        if (!brand && !model) {
            const query = `
                SELECT
                    MIN(mileage) AS min_mileage,
                    MAX(mileage) AS max_mileage
                FROM cars;
            `;

            const res = await client.query(query);
            const row = res.rows[0];

            return NextResponse.json({
                min_mileage: Number(row.min_mileage),
                max_mileage: Number(row.max_mileage),
            });
        }

        // Если есть model (независимо от brand) — вернуть данные по модели
        if (model) {
            const query = `
                SELECT
                    model,
                    MIN(mileage) AS min_mileage,
                    MAX(mileage) AS max_mileage
                FROM cars
                WHERE LOWER(model) = $1
                GROUP BY model
                ORDER BY model;
            `;

            const res = await client.query(query, [model]);

            if (res.rows.length === 0) {
                return NextResponse.json({ error: `Model '${model}' not found` }, { status: 404 });
            }

            const row = res.rows[0];
            return NextResponse.json({
                model: row.model,
                min_mileage: Number(row.min_mileage),
                max_mileage: Number(row.max_mileage),
            });
        }

        // Если запрос не попал ни в одно из условий — вернуть 400 Bad Request
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });

    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    } finally {
        client.release();
    }
}
