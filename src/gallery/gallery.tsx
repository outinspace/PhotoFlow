import React from 'react';
import ItemGrid from "./item.grid";
import { useGallery } from '../queries';
import { UploadDropZone } from '../common/upload.drop.zone';

const Gallery = () => {
    const { data: gallery } = useGallery();

    const items = gallery?.items ?? [];

    return (
        <UploadDropZone className='flex flex-auto flex-col overflow-hidden'>
            <ItemGrid items={items} albumId={null} />
        </UploadDropZone>
    )
};

export default Gallery;
