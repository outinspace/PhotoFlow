import React from 'react';
import ItemGrid from "./item.grid";
import { useGallery } from '../queries';
import { UploadDropZone } from '../common/upload.drop.zone';
import { useImagePrecache } from '../hooks/use.image.precache';

const Gallery = () => {
    const { data: gallery } = useGallery();

    const items = gallery?.items ?? [];

    useImagePrecache(items);

    return (
        <UploadDropZone className='flex flex-auto flex-col overflow-hidden'>
            <ItemGrid items={items} albumId={null} enableUrlPersistence />
        </UploadDropZone>
    )
};

export default Gallery;
