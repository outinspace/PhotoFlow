import React, { useRef, useLayoutEffect, useState, useCallback } from 'react';
import styled from '@emotion/styled';
import { Range, defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { ItemTile } from './item.tile';
import { Item } from './types';
import ItemPreview from './item.preview';
import GridZoomControl from './grid.zoom.control';
import constants from '../design.constants';
import { format } from 'date-fns';

interface Props {
    items: Item[];
}

const zoomControlOptions = [
    {
        name: 'Year',
        minTileSize: 50,
        showTileBorder: false,
        rangeDateFormat: 'MMMM yyyy'
    },
    {
        name: 'Month',
        minTileSize: 100,
        showTileBorder: true,
        rangeDateFormat: 'MMM do yyyy'
    },
    {
        name: 'Day',
        minTileSize: 150,
        showTileBorder: true,
        rangeDateFormat: 'MMM do yyyy'
    }
];

const ItemGrid = ({ items }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
    const selectedItem = selectedItemIndex === null ? null : items[selectedItemIndex];

    const [zoomLevel, setZoomLevel] = useState(zoomControlOptions[2]);

    const visibleRangeRef = useRef({ startIndex: 0, endIndex: 0 });

    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const columns = Math.floor(containerWidth / zoomLevel.minTileSize);
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

    const rangeStartItem: Item | undefined = items[visibleRangeRef.current.startIndex * columns];
    const rangeEndItem: Item | undefined = items[visibleRangeRef.current.endIndex * columns - 1];

    // TODO: Use enum
    let formattedRange = '';
    if (rangeStartItem && rangeEndItem) {
        const start = format(rangeStartItem.captureTime, zoomLevel.rangeDateFormat);
        const end = format(rangeEndItem.captureTime, zoomLevel.rangeDateFormat);
        formattedRange = `${start} - ${end}`;
    }

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
                                    <ItemTile showBorder={zoomLevel.showTileBorder} item={item} onClick={() => setSelectedItemIndex(rowIndex * columns + i)} />
                                </div>
                            ))}
                        </div>

                    );
                })}
            </div>
            <GridZoomControl options={zoomControlOptions} onSelect={value => setZoomLevel(value)} value={zoomLevel} />
            <RangeLabel>
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
    );
}

const GridContainer = styled.div`
    position: relative;
    flex: 1 1 auto;
    width: 100%;
    overflow-y: scroll;
    overflow-x: hidden;
`;

const RangeLabel = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(0,0,0,0.7) 100%);
    color: ${constants.colors.text.level0};
    font-family: Roboto, sans-serif;
    font-weight: 400;
    font-size: 24px;
    padding: ${constants.space.M};
`;

export default ItemGrid;
