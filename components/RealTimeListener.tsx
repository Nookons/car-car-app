'use client'

import {useEffect} from 'react'
import {supabase} from '@/lib/supabaseClient'
import {sendTelegramPhoto} from "@/telegram/sendMessage";

const getToken = async () => {
    fetch(`http://localhost:3000/api/get-telegram-token`)
        .then(res => res.json())
        .then(data => { return data })
}

export default function RealTimeListener() {
    useEffect(() => {
        const channel = supabase
            .channel('realtime:cars')
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT | UPDATE | DELETE
                    schema: 'public',
                    table: 'cars',
                },
                async (payload) => {
                    console.log('📦 Изменение в таблице cars:', payload)

                    if (payload.eventType === 'INSERT') {
                        try {
                            const res = await fetch('http://localhost:3000/api/get-users-for-ad', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(payload.new),
                            })

                            const data = await res.json()

                            console.log(data);

                            if (data.users.length > 0) {
                                data.users.forEach(async (user: any) => {
                                    await sendTelegramPhoto(user, payload.new)
                                })
                            }

                        } catch (err) {
                            console.error('❌ Ошибка при отправке:', err)
                        }
                    } else {
                        console.log('🚫 Игнорируем событие не INSERT:', payload)
                    }

                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    return <p>🔄 Слушаю изменения в таблице Supabase...</p>
}
