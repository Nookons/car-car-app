import React from 'react';
import {MapPin} from "lucide-react";

function getGoogleMapEmbedUrl(originalUrl: string): string | null {
    try {
        const url = new URL(originalUrl);
        let coords = url.searchParams.get('query');

        if (!coords) {
            coords = url.searchParams.get('center');
        }

        if (!coords) return null;

        return `https://www.google.com/maps?q=${coords}&z=15&output=embed`;
    } catch (e) {
        return null;
    }
}

const AdMap = ({link, location_text}: {link: string | undefined, location_text: string | undefined}) => {
    const googleMapEmbedUrl = getGoogleMapEmbedUrl(link || "");

    return (
        <div className={`mt-10`}>
            <div className={`flex gap-2 items-center mb-2 text-neutral-500 font-semibold`}>
                <MapPin />
                <p>{location_text || ""}</p>
            </div>
            {googleMapEmbedUrl && (
                <div className={`rounded overflow-hidden`} style={{width: '100%', height: '350px'}}>
                    <iframe
                        src={googleMapEmbedUrl}
                        width="100%"
                        height="100%"
                        style={{border: 0}}
                        allowFullScreen={true}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Car Location on Google Map"
                    ></iframe>
                </div>
            )}
        </div>
    );
};

export default AdMap;