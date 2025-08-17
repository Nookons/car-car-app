import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
        const { brand, model } = await request.json();

        if (!brand || !model) {
            return NextResponse.json({ error: "Brand and model are required" }, { status: 400 });
        }

        const client = await pool.connect();

        try {
            // ищем бренд по названию
            const brandResult = await client.query(
                "SELECT id FROM brands_list WHERE brand = $1",
                [brand]
            );

            if (brandResult.rows.length === 0) {
                return NextResponse.json({ error: "Brand not found" }, { status: 404 });
            }

            const brandId = brandResult.rows[0].id;

            // добавляем модель
            const modelResult = await client.query(
                "INSERT INTO models_list (brand_id, model) VALUES ($1, $2) RETURNING *",
                [brandId, model]
            );

            return NextResponse.json({ success: true, model: modelResult.rows[0] });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Database error:", error);
        return NextResponse.json({ error: "Failed to add model" }, { status: 500 });
    }
}
