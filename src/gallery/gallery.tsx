import React, { useRef, useLayoutEffect, useState, useEffect } from 'react';
import { useGallery } from './queries';
import styled from '@emotion/styled';
import { useVirtualizer } from '@tanstack/react-virtual';

const Gallery = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { data: gallery } = useGallery();
    const containerWidth = containerRef.current?.clientWidth ?? 0;

    const minTileSize = 200;
    let columns = Math.floor(containerWidth / minTileSize);
    const tileSize = containerWidth === 0 ? 0 : containerWidth / columns;

    const rowVirtualizer = useVirtualizer({
        enabled: tileSize > 0 && gallery?.items,
        count: gallery?.items.length ?? 0,
        getScrollElement: () => containerRef.current,
        estimateSize: () => tileSize,
        lanes: columns,
        overscan: columns * 3
    });

    console.debug('rerender', { containerWidth });

    useLayoutEffect(() => {
        const updateWidth = () => {
            console.debug('update width', containerWidth);
            rowVirtualizer.measure();
        };

        window.addEventListener('resize', updateWidth);

        // HACK:
        setTimeout(() => {
            updateWidth();
        }, 500);

        return () => window.removeEventListener('resize', updateWidth);
    }, []);

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
                            width: `${virtualItem.size}px`,
                            height: `${virtualItem.size}px`,
                            transform: `translateY(${virtualItem.start}px)`
                        }}
                    >
                        <ItemThumbnail item={gallery.items[virtualItem.index]} />
                    </div>
                ))}
            </div>
        </GalleryContainer>
    );
}

const ItemThumbnail = ({ item }) => {
    const [isHovering, setIsHovering] = useState(false);
    const primaryFile = item.files.find(_ => _.contentType.startsWith('image')) ?? item.files[0];
    const videoFile = item.files.find(_ => _.contentType.startsWith('video'));

    const showLivePhoto = isHovering && videoFile;

    return (
        <div
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={() => open(primaryFile.previewUrl)}
            style={{
                height: '100%',
                width: '100%',
                outline: 'solid white 1px',
                display: 'flex'
            }}>
            {showLivePhoto && (
                <video autoPlay controls={false} loop muted
                    poster={primaryFile.tileImageUrl}
                    style={{
                        objectFit: 'cover',
                        flex: '1 1 auto'
                    }}>
                    <source src={videoFile.previewUrl} type="video/mp4" />
                </video>
            )}
            {!showLivePhoto && (
                <img src={primaryFile.tileImageUrl} />
            )}
        </div>
    );
}

const GalleryContainer = styled.div`
    flex: 1 1 auto;
    width: 100%;
    overflow: auto;
`;

export default Gallery;
