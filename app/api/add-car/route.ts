import pool from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            title,
            posted_time,
            price,
            url,
            brand,
            model,
            version,
            color,
            door_count,
            seats_count,
            production_year,
            generation,
            image_url,
            fuel_type,
            engine_capacity,
            engine_power,
            body_type,
            gearbox,
            transmission,
            mileage,
            condition,
            platform,
            map_link,
            city,
            seller_type,
        } = body;

        // Проверка обязательных полей
        if (!title || !posted_time || !map_link || !url || !price) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const client = await pool.connect();

        try {
            const query = `
                INSERT INTO cars (
                    title,
                    posted_time,
                    price,
                    url,
                    brand,
                    model,
                    version,
                    color,
                    door_count,
                    seats_count,
                    production_year,
                    generation,
                    image_url,
                    fuel_type,
                    engine_capacity,
                    engine_power,
                    body_type,
                    gearbox,
                    transmission,
                    mileage,
                    condition,
                    platform,
                    map_link,
                    city,
                    seller_type
                ) VALUES (
                             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                             $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                             $21, $22, $23, $24, $25
                         )
                    ON CONFLICT (url) DO NOTHING
                RETURNING *;
            `;

            const values = [
                title,
                posted_time,
                price,
                url,
                brand,
                model,
                version,
                color,
                door_count,
                seats_count,
                production_year,
                generation,
                image_url,
                fuel_type,
                engine_capacity,
                engine_power,
                body_type,
                gearbox,
                transmission,
                mileage,
                condition,
                platform,
                map_link,
                city,
                seller_type
            ];

            const result = await client.query(query, values);

            if (result.rowCount === 0) {
                return NextResponse.json({ message: "Car already exists" }, { status: 200 });
            }

            return NextResponse.json({ car: result.rows[0] }, { status: 201 });

        } finally {
            client.release();
        }
    } catch (error) {
        console.error("❌ Database insert error:", error);
        return NextResponse.json({ error: `Failed to insert car ${error}` }, { status: 500 });
    }
}
