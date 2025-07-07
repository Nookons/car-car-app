import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const { lat, lng } = await req.json()
    const key = process.env.OPENCAGE_API_KEY

    if (!key) {
        return NextResponse.json({ error: 'Missing API key' }, { status: 500 })
    }

    try {
        const res = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${lat},${lng}&key=${key}`
        )
        const data = await res.json()
        const formatted = data.results?.[0]?.formatted ?? null
        return NextResponse.json({ formatted })
    } catch (err) {
        return NextResponse.json({ error: 'Failed to fetch geocode' }, { status: 500 })
    }
}
