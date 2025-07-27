import React from 'react';

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

const AdMap = ({link}: {link: string | undefined}) => {
    const googleMapEmbedUrl = getGoogleMapEmbedUrl(link || "");

    return (
        <div className={`mt-10`}>
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