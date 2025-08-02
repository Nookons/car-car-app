import {NextRequest, NextResponse} from "next/server";

export async function GET(request: NextRequest) {
    try {
        const botToken = process.env.BOT_TOKEN;

        if (botToken === undefined) {
            NextResponse.json({ error: "No botToken found." }, {status: 401});
        }

        NextResponse.json({ success: true, token: botToken }, {status: 200});
    } catch (error) {
        NextResponse.json({ error: "Error." }, {status: 404});
    }
}