import React, { useRef, useLayoutEffect, useState } from 'react';
import { useGallery } from './queries';
import styled from '@emotion/styled';
import { useVirtualizer } from '@tanstack/react-virtual';

const Gallery = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { data: gallery } = useGallery();
    const [containerWidth, setContainerWidth] = useState(0);

    const columns = 5;
    const tileSize = containerWidth === 0 ? 0 : containerWidth / columns;

    const rowVirtualizer = useVirtualizer({
        enabled: tileSize > 0,
        count: gallery?.items.length ?? 0,
        getScrollElement: () => containerRef.current,
        estimateSize: () => tileSize,
        lanes: columns
    });

    console.log('rerender', {containerWidth});

    useLayoutEffect(() => {
        const updateWidth = () => {
            setContainerWidth(containerRef.current?.clientWidth ?? 0);
        };

        window.addEventListener('resize', updateWidth);

        updateWidth();

        return () => window.removeEventListener('resize', updateWidth);
    })

    if (!gallery) {
        return;
    }

    return (
        <GalleryContainer ref={containerRef}>
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative'
                }}
            >
                {rowVirtualizer.getVirtualItems().map((virtualItem) => (
                    <div
                        key={virtualItem.key}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: virtualItem.lane * tileSize,
                            width: tileSize,
                            height: `${virtualItem.size}px`,
                            transform: `translateY(${virtualItem.start}px)`
                        }}
                    >
                        <ItemThumbnail size={tileSize} item={gallery.items[virtualItem.index]} />
                    </div>
                ))}
            </div>
        </GalleryContainer>
    );
}

const ItemThumbnail = ({ item, size }) => {
    const primaryFile = item.files.find(_ => _.contentType.startsWith('image')) ?? item.files[0];

    return (
        <div
            onClick={() => open(primaryFile.previewUrl)}
            style={{
                background: `url(${item.files[0].tileImageUrl}) no-repeat`,
                backgroundSize: 'cover',
                height: size,
                width: size
                // minHeight: '100px',
                // minWidth: '100px',
                // height: '100%',
                // width: '100%'
            }}>
        </div>
    );
}

// const GalleryContainer = styled.div`
//     display: grid;
//     grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
//     grid-gap: 2px;
//     height: 100%;
//     width: 100%;
// `;

const GalleryContainer = styled.div`
    height: 100%;
    width: 100%;
    overflow: auto;
`;

export default Gallery;
