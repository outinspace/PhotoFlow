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
    const containerRef = useRef<HTMLDivElement>(null);
    const containerWidth = containerRef.current?.clientWidth ?? 0;

    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
    const selectedItem = selectedItemIndex === null ? null : items[selectedItemIndex];

    const minTileSize = 150;
    const columns = Math.floor(containerWidth / minTileSize);
    const rows = Math.ceil(items.length / columns);
    const tileSize = containerWidth === 0 ? 0 : containerWidth / columns;

    const rowVirtualizer = useVirtualizer({
        enabled: tileSize > 0,
        count: rows ?? 0,
        getScrollElement: () => containerRef.current,
        estimateSize: () => tileSize,
        overscan: 5
    });

    // HACK:
    useLayoutEffect(() => {
        const updateWidth = () => {
            rowVirtualizer.measure();
        };

        window.addEventListener('resize', updateWidth);

        setTimeout(() => {
            updateWidth();
        }, 100);

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
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const rowIndex = virtualRow.index;

                    const rowItems: Item[] = [];
                    for (let i = 0; i < columns; i++) {
                        const itemIndex = rowIndex * columns + i;
                        if (items[itemIndex]) {
                            rowItems.push(items[itemIndex]);
                        }
                    }

                    return (
                        <div
                            key={virtualRow.key}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`
                            }}
                        >
                            {rowItems.map((item, i) => (
                                <div
                                    key={item.itemId}
                                    style={{
                                        position: 'absolute',
                                        left: tileSize * i,
                                        width: tileSize,
                                        height: tileSize
                                    }}
                                >
                                    <ItemTile item={item} onClick={() => setSelectedItemIndex(rowIndex * columns + i)} />
                                </div>
                            ))}
                        </div>

                    );
                })}
            </div>
            {selectedItem && (
                <ItemPreview
                    key={selectedItem.itemId}
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
