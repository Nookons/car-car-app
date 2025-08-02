import {ICarAdd} from "@/types/Car";

export async function fetchCarData(): Promise<ICarAdd[]> {
    try {
        const base_url = process.env.NEXT_PUBLIC_BASE_URL;
        const res = await fetch(`${base_url}api/all-cars`);
        if (!res.ok) throw new Error("Network response was not ok");
        return await res.json();
    } catch (err) {
        throw err instanceof Error ? err : new Error("Unknown error");
    }
}