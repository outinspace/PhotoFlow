import React, { useRef, useLayoutEffect, useState } from 'react';
import styled from '@emotion/styled';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ItemTile } from './item.tile';
import { Item } from './types';
import ItemPreview from './item.preview';

interface Props {
    items: Item[];
}

const ItemGrid = ({ items }: Props) => {
    const containerRef = useRef(null);
    const containerWidth = containerRef.current?.clientWidth ?? 0;

    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
    const selectedItem = selectedItemIndex == null ? null : items[selectedItemIndex];

    const minTileSize = 200;
    let columns = Math.floor(containerWidth / minTileSize);
    const tileSize = containerWidth === 0 ? 0 : containerWidth / columns;

    const rowVirtualizer = useVirtualizer({
        enabled: tileSize > 0,
        count: items.length ?? 0,
        getScrollElement: () => containerRef.current,
        estimateSize: () => tileSize,
        lanes: columns,
        overscan: columns * 3
    });

    // console.debug('rerender', { containerWidth });

    useLayoutEffect(() => {
        const updateWidth = () => {
            // console.debug('update width', containerWidth);
            rowVirtualizer.measure();
        };

        window.addEventListener('resize', updateWidth);

        // HACK:
        setTimeout(() => {
            updateWidth();
        }, 500);

        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    return (
        <GridContainer ref={containerRef}>
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
                        <ItemTile item={items[virtualItem.index]} onClick={() => setSelectedItemIndex(virtualItem.index)} />
                    </div>
                ))}
            </div>
            {selectedItem && (
                <ItemPreview
                    item={selectedItem}
                    onMovePrevious={() => setSelectedItemIndex(selectedItemIndex === 0 ? 0 : selectedItemIndex! - 1)}
                    onMoveNext={() => setSelectedItemIndex(selectedItemIndex === items.length - 1 ? items.length - 1 : selectedItemIndex! + 1)}
                    onClose={() => setSelectedItemIndex(null)}
                />
            )}
        </GridContainer>
    );
}

const GridContainer = styled.div`
    flex: 1 1 auto;
    width: 100%;
    overflow: auto;
`;

export default ItemGrid;
