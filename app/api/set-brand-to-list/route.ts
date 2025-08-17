import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { brand } = body;

        if (!brand) {
            return NextResponse.json({ error: "Brand is required" }, { status: 400 });
        }

        const client = await pool.connect();

        try {
            const query = `INSERT INTO brands_list (brand) VALUES ($1) RETURNING *`;
            const values = [brand];

            const result = await client.query(query, values);

            return NextResponse.json({ success: true, brand: result.rows[0] });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Database error:", error);
        return NextResponse.json(
            { error: "Failed to add brand" },
            { status: 500 }
        );
    }
}
