'use client'

import React, { useEffect, useState } from 'react'
import { CircleGauge } from 'lucide-react'

interface Props {
    location: { lat: number; lng: number } | null;
    setLocation: (location: { lat: number; lng: number }) => void;
    locationString: string;
    setLocationString: (locationString: string) => void;
}

const GetUserLocation: React.FC<Props> = ({ location, setLocation, locationString, setLocationString }) => {
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser.')
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                })
            },
            (err) => {
                setError('Unable to retrieve your location. ' + err.message)
            }
        )
    }, [])

    useEffect(() => {
        if (location) {
            fetch('/api/geocode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(location),
            })
                .then((res) => res.json())
                .then((data) => {
                    if (data.formatted) {
                        setLocationString(data.formatted)
                    } else {
                        setError('Failed to fetch location name')
                    }
                })
                .catch((err) => {
                    setError('Failed to fetch geocode: ' + err.message)
                })
        }
    }, [location])

    return (
        <div className="pb-4">
            {locationString ? (
                <div className="flex gap-4 items-center">
                    <p className="text-xs font-light text-neutral-500">
                        Your Address:{' '}
                        <span className="text-primary font-bold">{locationString}</span>
                    </p>
                </div>
            ) : error ? (
                <p className="text-red-500">{error}</p>
            ) : (
                <div className="flex gap-4 items-center">
                    <CircleGauge className="animate-spin" size={18} />
                    <p className="text-neutral-500 text-xs">Getting location...</p>
                </div>
            )}
        </div>
    )
}

export default GetUserLocation
