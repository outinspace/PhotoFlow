import React from 'react';
import ItemGrid from "./item.grid";
import { useGallery } from "./queries";

const Gallery = () => {
    const { data: gallery } = useGallery();

    return (
        <ItemGrid items={gallery?.items ?? []} />
    )
};

export default Gallery;
