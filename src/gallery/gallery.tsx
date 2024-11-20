import React, { useMemo } from 'react';
import ItemGrid from "./item.grid";
import { useGallery } from '../queries';

const Gallery = () => {
    const { data: gallery } = useGallery();

    const items = gallery?.items ?? [];

    const gridItems = useMemo(() => {

        // Only display items with thumbnails
        const filteredItems = items.filter(i => i.files.every(f => f.processedVersion !== null));

        return filteredItems.sort((a, b) => a.captureTime < b.captureTime ? 1 : -1); // Date descending
    }, [gallery?.items]);

    const processingItemsCount = items.filter(i => i.files.some(f => f.processedVersion === null)).length;

    return (
        <div className='flex flex-auto flex-col overflow-scroll'>
            {processingItemsCount > 0 && (
                <div className='p-1 bg-sky-100 text-sky-700 flex justify-center'>
                    {`${processingItemsCount} photos/videos are being processed.`}
                </div>
            )}
            <div className='flex flex-auto overflow-scroll relative'>
                <ItemGrid items={gridItems} />
            </div>
        </div>
    )
};

export default Gallery;
