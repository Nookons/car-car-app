import { NextResponse } from "next/server";
import {supabase} from "@/lib/supabaseClient";

export async function GET() {
    try {
        const { data, error } = await supabase.rpc('get_cars');

        if (error) {
            console.error('RPC error:', error);
            return NextResponse.json({ error: 'Failed to fetch cars from Supabase function' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (err) {
        console.error('Server error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
