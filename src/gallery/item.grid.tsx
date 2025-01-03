import React, { useRef, useLayoutEffect, useState, useCallback } from 'react';
import styled from '@emotion/styled';
import { Range, defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { ItemTile } from './item.tile';
import { Item } from '../types';
import ItemPreview from './item.preview';
import { format } from 'date-fns';
import { usePinch } from '@use-gesture/react';

interface Props {
    items: Item[];
}

const ItemGrid = ({ items }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
    const selectedItem = selectedItemIndex === null ? null : items[selectedItemIndex];

    const [minTileSize, setMinTileSize] = useState(80);
    console.log({ minTileSize })

    const rangeDateFormat = minTileSize > 50 ? 'MMM d yyyy' : 'MMMM yyyy';
    const showTileBorder = minTileSize > 50 ? true : false;

    const visibleRangeRef = useRef({ startIndex: 0, endIndex: 0 });

    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const columns = Math.floor(containerWidth / minTileSize);
    const rows = Math.ceil(items.length / columns);
    const tileSize = containerWidth === 0 ? 0 : containerWidth / columns;

    const rowVirtualizer = useVirtualizer({
        enabled: tileSize > 0,
        count: rows ?? 0,
        getScrollElement: () => containerRef.current,
        estimateSize: () => tileSize,
        overscan: 5,
        rangeExtractor: useCallback((range: Range) => {
            visibleRangeRef.current = {
                startIndex: range.startIndex,
                endIndex: range.endIndex
            };

            return defaultRangeExtractor(range);
        }, [])
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

    usePinch(e => {
        let newMinTileSize = e.offset[0] * 80;
        if (newMinTileSize < 30) {
            newMinTileSize = 30;
        }
        if (newMinTileSize > 300) {
            newMinTileSize = 300;
        }
        setMinTileSize(newMinTileSize);
    }, {
        target: containerRef
    });

    const rangeStartItem: Item | undefined = items[visibleRangeRef.current.startIndex * columns];
    const rangeEndItem: Item | undefined = items[visibleRangeRef.current.endIndex * columns - 1];

    // TODO: Use enum
    let formattedRange = '';
    if (rangeStartItem && rangeEndItem) {
        const start = format(rangeStartItem.captureTime, rangeDateFormat);
        formattedRange = start;
    }

    return (
        <div className='flex flex-auto overflow-hidden relative'>
            <GridContainer ref={containerRef} className='touch-none touch-pan-y'>
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
                                        <ItemTile showBorder={showTileBorder} minTileSize={minTileSize} item={item} onClick={() => setSelectedItemIndex(rowIndex * columns + i)} />
                                    </div>
                                ))}
                            </div>

                        );
                    })}
                </div>
                <RangeLabel className='absolute top-4 left-4 text-slate-50 font-bold text-2xl drop-shadow select-none pointer-events-none'>
                    {formattedRange}
                </RangeLabel>
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
        </div>
    );
}

const GridContainer = styled.div`
    flex: 1 1 auto;
    width: 100%;
    overflow-y: scroll;
    overflow-x: hidden;
`;

const RangeLabel = styled.div`
    filter: drop-shadow(0px 0px 10px black);
`;

export default ItemGrid;
