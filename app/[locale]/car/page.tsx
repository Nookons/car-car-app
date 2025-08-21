'use client';
import {useUserStore} from "@/store/user/userStore";
import {useQuery} from "@tanstack/react-query";
import {getListForUser} from "@/features/cars/getListForUser";
import {Card} from "@/components/ComponentsProvider";
import Link from "next/link";
import {useEffect} from "react";

export default function Page() {
    const user_data = useUserStore(state => state.user_data)

    const {data, isLoading, isError, error} = useQuery<any, Error>({
        queryKey: ['test', user_data.user_id],
        queryFn: () => getListForUser({ uid: user_data.user_id.toString(), pageNumber: 1 }), // ✅
        enabled: !!user_data.user_id,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        console.log(data);
    }, [data]);


    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!data) return <div>Error</div>;

    return (
        <div className="p-2 flex flex-col gap-2">
            {data.map((item: any) => {

                return (
                    <Link href={`/en/car/${item.id}`} key={item.id} className="block">
                        <Card>
                            <div className={`rounded overflow-hidden mb-2`}>
                                <img src={item.images[0].replace('s=148x110', 's=800x600')} alt={`${item.brand} ${item.model}`} className="w-full h-48 object-cover" />
                            </div>
                            <h2 className="text-lg font-bold">{item.title}</h2>
                            <p>Price: {item.price} {item.currency}</p>
                            <p>Mileage: {item.mileage} km</p>
                            <p>Year: {item.year}</p>
                            <p>Seller Type: {item.seller_type}</p>
                            <p>Platform: {item.platform}</p>
                            <p>Condition: {item.new_used}</p>
                        </Card>
                    </Link>
                )
            })}
        </div>
    );
}
