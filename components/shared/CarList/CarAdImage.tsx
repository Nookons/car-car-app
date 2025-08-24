import React from 'react';
import {ICarAdd} from "@/types/Car";

const CarAdImage = ({carAd}: {carAd: ICarAdd}) => {
    return (
        <div className="relative w-full overflow-hidden mb-2 rounded aspect-[4/3]">
            <div className="relative w-full overflow-hidden mb-2 rounded aspect-[4/3]">
                <img
                    src={
                        carAd.images[1]
                            ? carAd.images[1].replace('s=148x110', 's=800x600')
                            : carAd.images[4]
                                ? carAd.images[4].replace('s=148x110', 's=800x600')
                                : 'https://www.autopedigree.co.za/media/cache/resolve/model_jpeg/images/home-page/body-type/body-fallback.jpg'
                    }
                    alt={`${carAd.brand} ${carAd.model}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                />
            </div>
        </div>
    );
};

export default CarAdImage;