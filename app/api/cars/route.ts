import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';


const EARTH_RADIUS_KM = 6371;

// Функция для извлечения координат из ссылки
function extractLatLngFromGoogleMapsUrl(url: string): { lat: number, lng: number } | null {
    try {
        const parsedUrl = new URL(url);
        const coords = parsedUrl.searchParams.get("query") || parsedUrl.searchParams.get("center");
        if (!coords) return null;

        const [lat, lng] = coords.split(",").map(Number);
        return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
    } catch {
        return null;
    }
}

// Haversine: Расчёт расстояния между двумя координатами
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (angle: number) => angle * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const client = await pool.connect();

        // Получаем настройки пользователя
        const userRes = await client.query(`
            SELECT * FROM user_search_settings WHERE user_id = $1
        `, [userId]);

        if (userRes.rowCount === 0) {
            client.release();
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = userRes.rows[0];

        const carRes = await client.query(`
            SELECT c.*
            FROM cars c
                     LEFT JOIN user_saw_ad usa
                               ON usa.ad_id = c.id AND usa.user_id = $7
            WHERE
                usa.ad_id IS NULL
              AND ($1::text IS NULL OR LOWER(c.brand) = LOWER($1))
              AND ($2::text IS NULL OR LOWER(c.model) = LOWER($2))
              AND ($3::int IS NULL OR c.price >= $3)
              AND ($4::int IS NULL OR c.price <= $4)
              AND ($5::text IS NULL OR c.production_year >= $5)
              AND ($6::text IS NULL OR c.production_year <= $6)
            ORDER BY c.posted_time DESC
                LIMIT 2000
        `, [
            user.brand,
            user.model,
            user.min_price === 0 ? null : user.min_price,
            user.max_price === 0 ? null : user.max_price,
            user.min_year,
            user.max_year,
            userId
        ]);


        const allCars = carRes.rows;

        const filteredCars = allCars.filter(car => {
            if (!user.lat || !user.lng || !user.from_user_range) return true;

            const coords = extractLatLngFromGoogleMapsUrl(car.map_link);
            if (!coords) return false;

            const distance = calculateDistanceKm(user.lat, user.lng, coords.lat, coords.lng);
            return distance <= user.from_user_range;
        });

        client.release();
        return NextResponse.json(filteredCars);
    } catch (error) {
        console.error('Error fetching filtered cars:', error);
        return NextResponse.json({ error: 'Failed to fetch cars' }, { status: 500 });
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
