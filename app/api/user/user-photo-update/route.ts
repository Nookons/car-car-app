import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
    const client = await pool.connect();

    try {
        const url = new URL(request.url);
        const chat_id = Number(url.searchParams.get("uid"));
        const photo_url = url.searchParams.get("photo_url");

        if (!chat_id || !photo_url) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        const query = `SELECT update_user_photo($1, $2) AS success;`;
        const res = await client.query(query, [chat_id, photo_url]);

        return NextResponse.json(res.rows[0], { status: 200 });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    } finally {
        client.release();
    }
}
