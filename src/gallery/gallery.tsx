import React from 'react';
import { useGallery } from './queries';
import styled from '@emotion/styled';

const Gallery = () => {
    const { data: gallery } = useGallery();

    if (!gallery) {
        return;
    }

    return (
        <GalleryContainer>
            {gallery.items.map(item => <ItemThumbnail key={item.itemId} item={item} />)}
        </GalleryContainer>
    );
}

const ItemThumbnail = ({ item }) => {
    const primaryFile = item.files.find(_ => _.contentType.startsWith('image/')) ?? item.files[0];

    return (
        <div
            onClick={() => open(primaryFile.fullQualityUrl)}
            style={{
                background: `url(${item.files[0].previewImageSmallUrl}) no-repeat`,
                backgroundSize: 'cover',
                minHeight: '100px',
                minWidth: '100px',
                height: '100%',
                width: '100%'
            }}>
        </div>
    );
}

const GalleryContainer = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    grid-gap: 2px;
    height: 100%;
    width: 100%;
`;

export default Gallery;
