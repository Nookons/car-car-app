'use client';
import React, {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useUserStore} from '@/store/user/userStore';
import {Skeleton} from '@/components/ui/skeleton';
import CarListAd from '@/components/shared/CarList/CarListAd';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    PaginationEllipsis
} from '@/components/ui/pagination';
import {getListForUser} from '@/features/cars/getListForUser';
import {Button, Card, CardContent, CardFooter, CardHeader, CardTitle} from "@/components/ComponentsProvider";
import {SearchX} from "lucide-react";
import Link from "next/link";

const CarList = () => {
    const [pageNumber, setPageNumber] = useState(1);
    const user_data = useUserStore(state => state.user_data);

    const {data, isLoading} = useQuery({
        queryKey: ['user_car_list', user_data.user_id, pageNumber],
        queryFn: () => getListForUser({uid: user_data.user_id.toString(), pageNumber}),
        enabled: !!user_data.user_id,
    });

    if (isLoading || !user_data.user_id) {
        return (
            <div className="p-4 flex flex-col gap-2">
                {Array.from({length: 10}).map((_, index) => (
                    <Skeleton key={index} className="w-full h-48 mb-2"/>
                ))}
            </div>
        );
    }

    if (!data) return <div>Error</div>;

    // Функция, которая формирует массив страниц для отображения
    const getPageNumbers = () => {
        const pages: (number | 'ellipsis')[] = [];
        const delta = 2; // сколько страниц показывать слева/справа от текущей

        const left = Math.max(2, pageNumber - delta);
        const right = Math.min(data.totalPages - 1, pageNumber + delta);

        pages.push(1); // первая страница всегда

        if (left > 2) {
            pages.push('ellipsis');
        }

        for (let i = left; i <= right; i++) {
            pages.push(i);
        }

        if (right < data.totalPages - 1) {
            pages.push('ellipsis');
        }

        if (data.totalPages > 1) {
            pages.push(data.totalPages); // последняя страница всегда
        }

        return pages;
    };

    if (data.items.length === 0) {
        return (
            <Card className="max-w-md w-full text-center p-6 shadow-lg rounded-2xl border ">
                <CardHeader>
                    <div className="flex justify-center mb-2">
                        <SearchX className="w-12 h-12 "/>
                    </div>
                    <CardTitle className="text-2xl font-bold ">Opppsss...</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-neutral-500 text-base">
                        We can't find any cars for you right now.<br/>
                        Try changing your filters or check back later.
                    </p>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Link href={`/${user_data.language_code}/telegram-form`}>
                        <Button
                        >
                            Change my filters
                        </Button>
                    </Link>
                </CardFooter>
            </Card>
        )
    }

    return (
        <div className="flex flex-col items-center gap-4">
            {data.items.map((carAd: any) => (
                <CarListAd key={carAd.id} carAd={carAd}/>
            ))}

            {data.totalPages > 1 ? (
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (pageNumber > 1) setPageNumber(pageNumber - 1);
                                    }}
                                />
                            </PaginationItem>

                            {getPageNumbers().map((p, idx) => (
                                <PaginationItem key={idx}>
                                    {p === 'ellipsis' ? (
                                        <PaginationEllipsis/>
                                    ) : (
                                        <PaginationLink
                                            href="#"
                                            isActive={pageNumber === p}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setPageNumber(p);
                                            }}
                                        >
                                            {p}
                                        </PaginationLink>
                                    )}
                                </PaginationItem>
                            ))}

                            <PaginationItem>
                                <PaginationNext
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (pageNumber < data.totalPages) setPageNumber(pageNumber + 1);
                                    }}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                )
                :
                <div>This is all what we have right now for you</div>
            }
        </div>
    );
};

export default CarList;
