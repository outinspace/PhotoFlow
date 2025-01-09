import React from 'react';
import ItemGrid from "./item.grid";
import { useGallery } from '../queries';

const Gallery = () => {
    const { data: gallery } = useGallery();

    const items = gallery?.items ?? [];

    return (
        <ItemGrid items={items} albumId={null} />
    )
};

export default Gallery;
