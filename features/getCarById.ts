import {ICarAdd} from "@/types/Car";

export async function getCarById(id: string): Promise<ICarAdd> {
    try {
        const base_url = process.env.NEXT_PUBLIC_BASE_URL;
        const res = await fetch(`${base_url}api/get-car?car_id=${id}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return await res.json();
    } catch (error) {
        console.error("Fetch error:", error);
        throw new Error("Failed to load car data");
    }
}