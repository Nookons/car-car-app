'use client';
import React, {useEffect, useState} from 'react';
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
import {Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Command,
    CommandEmpty,
    CommandGroup,
    CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger} from "@/components/ComponentsProvider";
import {
    ArrowDownAZ,
    ArrowDownNarrowWide,
    ArrowDownWideNarrow,
    CalendarArrowDown,
    CalendarArrowUp,
    Check,
    ChevronsUpDown,
    SearchX, Settings2
} from "lucide-react";
import Link from "next/link";
import { cn } from '@/lib/utils';
import Cookies from "js-cookie";

const frameworks = [
    {
        value: "min_price",
        label: <span className={`flex items-center gap-2`}><ArrowDownNarrowWide /> Min Price</span>,
    },
    {
        value: "max_price",
        label: <span className={`flex items-center gap-2`}><ArrowDownWideNarrow /> Max Price</span>,
    },
    {
        value: "new_first",
        label: <span className={`flex items-center gap-2`}><CalendarArrowDown /> New first</span>,
    },
    {
        value: "old_first",
        label: <span className={`flex items-center gap-2`}><CalendarArrowUp /> Old first</span>,
    },
]

const CarList = () => {
    const [pageNumber, setPageNumber] = useState(1);
    const user_data = useUserStore(state => state.user_data);

    const [open, setOpen] = React.useState(false)
    const [value, setValue] = React.useState("")

    // 👉 при монтировании читаем из cookie
    useEffect(() => {
        const savedPage = Cookies.get("car_page");
        if (savedPage) {
            setPageNumber(parseInt(savedPage, 10));
        }
    }, []);


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


    const setNewPage = ({ e, newPage }: { e: React.MouseEvent<HTMLAnchorElement>, newPage: number }) => {
        e.preventDefault();
        setPageNumber(newPage);
        Cookies.set("car_page", String(newPage), { expires: 1/288 }); // ✅ сохраняем здесь

        let scrolled = false;

        // 👉 сначала пробуем через Telegram API
        try {
            if (window.Telegram?.WebApp?.scrollTo) {
                window.Telegram.WebApp.scrollTo(0, 0);
                scrolled = true;
            }
        } catch (err) {
            console.warn("Telegram scrollTo failed:", err);
        }

        // 👉 если не получилось — fallback
        if (!scrolled) {
            if (document.scrollingElement) {
                document.scrollingElement.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        }
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
        <div className="flex max-w-full m-auto overflow-hidden flex-col items-center gap-2">
            <div className={`w-full p-0`}>
                <span className={`text-xs text-neutral-500`}>Sorting by:</span>
            </div>
            <div className={`grid grid-cols-[1fr_50px] gap-2 w-full`}>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className="justify-between"
                            >
                                {value
                                    ? frameworks.find((framework) => framework.value === value)?.label
                                    : "Select sort type..."}
                                <ArrowDownAZ />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[calc(100vw-16px)] ml-2">
                            <Command>
                                <CommandList>
                                    <CommandEmpty>No framework found.</CommandEmpty>
                                    <CommandGroup>
                                        {frameworks.map((framework) => (
                                            <CommandItem
                                                key={framework.value}
                                                value={framework.value}
                                                onSelect={(currentValue) => {
                                                    setValue(currentValue === value ? "" : currentValue)
                                                    setOpen(false)
                                                }}
                                            >
                                                {framework.label}
                                                <Check
                                                    className={cn(
                                                        "ml-auto",
                                                        value === framework.value ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                <Button className={`w-full`} >
                    <Settings2 />
                </Button>
            </div>
            {data.items.map((carAd: any) => (
                <CarListAd key={carAd.id} carAd={carAd}/>
            ))}

            {data.totalPages > 1 ? (
                    <Pagination className={`pb-12`}>
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
                                            onClick={(e) => setNewPage({e, newPage: p as number})}
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
                <div className={`pb-12 text-neutral-500 text-xs`}>This is all what we have right now for you</div>
            }
        </div>
    );
};

export default CarList;
