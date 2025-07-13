import pool from "@/lib/db";
import {NextRequest, NextResponse} from "next/server";
import {PoolClient} from "pg";

// Универсальная функция безопасного запроса с повторной попыткой
async function safeQuery(
    client: PoolClient,
    queryText: string,
    params: any[],
    retries = 2
): Promise<any> {
    try {
        return await client.query(queryText, params);
    } catch (err: any) {
        const retryableCodes = ['57P01', '57P03', 'XX000'];
        if (retryableCodes.includes(err.code) && retries > 0) {
            console.warn(`Retrying query due to DB error ${err.code} (${retries} retries left)`);
            await new Promise((res) => setTimeout(res, 1000));
            return safeQuery(client, queryText, params, retries - 1);
        }
        throw err;
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const carUrl = searchParams.get("car_url");

        if (!carUrl || carUrl.trim().length === 0) {
            return NextResponse.json(
                { error: "Invalid car_url parameter" },
                { status: 400 }
            );
        }

        const client = await pool.connect();

        try {
            const res = await safeQuery(
                client,
                `SELECT 1 AS exists FROM cars WHERE url = $1 LIMIT 1`,
                [carUrl]
            );

            return NextResponse.json(res.rows);
        } finally {
            client.release(); // обязательно освобождаем соединение
        }
    } catch (error: any) {
        console.error("Database query error:", error);
        return NextResponse.json(
            { error: "Failed to fetch cars" },
            { status: 500 }
        );
    }
}