import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('user_id')?.trim();

        if (!id) {
            const query = `
                SELECT * FROM public.user_search_settings
            `;

            const res = await client.query(query);

            if (res.rows.length === 0) {
                return NextResponse.json({ error: 'Users not found' }, { status: 404 });
            }

            return NextResponse.json(res.rows, { status: 200 });
        }

        const query = `
            SELECT * FROM public.user_search_settings
            WHERE user_id = $1
        `;

        const res = await client.query(query, [id]);

        if (res.rows.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(res.rows[0], { status: 200 });
    } catch (error) {
        console.error('Database query error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    } finally {
        client.release();
    }
}


export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            id,
            brand,
            model,
            min_year,
            max_year,
            min_price,
            max_price,
            lat,
            lng,
            location_string,
            from_user_range,
            max_milage,
            sellerTypes,
            platformTypes,
            conditionTypes
        } = body;

        if (!id || id === 'none') {
            return NextResponse.json({ error: `User id is none` }, { status: 404 });
        }

        const client = await pool.connect();

        try {
            const checkQuery = 'SELECT user_id FROM user_search_settings WHERE user_id = $1';
            const checkResult = await client.query(checkQuery, [id]);

            const values = [
                id,
                brand || null,
                model || null,
                min_year || null,
                max_year || null,
                min_price || 0,
                max_price || 0,
                lat || null,
                lng || null,
                location_string || null,
                from_user_range || null,
                max_milage || null,
                sellerTypes || null,
                platformTypes || null,
                conditionTypes || null
            ];

            if ((checkResult?.rowCount ?? 0) > 0) {
                const updateQuery = `
                    UPDATE user_search_settings SET
                                                    brand = $2,
                                                    model = $3,
                                                    min_year = $4,
                                                    max_year = $5,
                                                    min_price = $6,
                                                    max_price = $7,
                                                    lat = $8,
                                                    lng = $9,
                                                    location = ST_SetSRID(ST_MakePoint($9, $8), 4326),
                                                    location_string = $10,
                                                    from_user_range = $11,
                                                    max_mileage = $12,
                                                    seller_types = $13,
                                                    platform_types = $14,
                                                    condition_types = $15,
                                                    updated_at = NOW()
                    WHERE user_id = $1
                        RETURNING *;
                `;

                const result = await client.query(updateQuery, values);
                return NextResponse.json({ settings: result.rows[0] }, { status: 200 });
            } else {
                const insertQuery = `
                    INSERT INTO user_search_settings (
                        user_id, brand, model, min_year, max_year, min_price, max_price,
                        lat, lng, location, location_string, from_user_range,
                        max_mileage, seller_types, platform_types, condition_types,
                        created_at, updated_at
                    ) VALUES (
                                 $1, $2, $3, $4, $5, $6, $7,
                                 $8, $9, ST_SetSRID(ST_MakePoint($9, $8), 4326), $10, $11,
                                 $12, $13, $14, $15,
                                 NOW(), NOW()
                             )
                        RETURNING *;
                `;

                const result = await client.query(insertQuery, values);
                return NextResponse.json({ settings: result.rows[0] }, { status: 201 });
            }
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to save user search settings' }, { status: 500 });
    }
}

