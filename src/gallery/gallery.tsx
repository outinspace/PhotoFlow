import React, { useMemo } from 'react';
import ItemGrid from "./item.grid";
import { useGallery } from "./queries";

const Gallery = () => {
    const { data: gallery } = useGallery();

    const sortedItems = useMemo(() => {
        const items = gallery?.items ?? [];
        return items.sort((a, b) => a.captureTime < b.captureTime ? -1 : 1);
    }, [gallery?.items]);

    return (
        <ItemGrid items={sortedItems} />
    )
};

export default Gallery;
