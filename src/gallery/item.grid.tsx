import React, { useRef, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { Range, defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { ItemTile } from './item.tile';
import { Item } from '../types';
import ItemPreview from './item.preview';
import GridZoomControl from './grid.zoom.control';
import { format } from 'date-fns';

interface Props {
    items: Item[];
}

const zoomControlOptions = [
    {
        name: 'Year',
        minTileSize: 40,
        showTileBorder: false,
        rangeDateFormat: 'MMMM yyyy'
    },
    {
        name: 'Month',
        minTileSize: 60,
        showTileBorder: true,
        rangeDateFormat: 'MMM d yyyy'
    },
    {
        name: 'Day',
        minTileSize: 80,
        showTileBorder: true,
        rangeDateFormat: 'MMM d yyyy'
    }
];

const ItemGrid = ({ items }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const [previewItemIndex, setPreviewItemIndex] = useState<number | null>(null);
    const previewItem = previewItemIndex === null ? null : items[previewItemIndex];

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

    let formattedRange = '';
    if (rangeStartItem && rangeEndItem) {
        const start = format(rangeStartItem.captureTime, zoomLevel.rangeDateFormat);
        formattedRange = start;
    }

    const [selectedItems, setSelectedItems] = useState<Record<number, Item>>({});
    const selectedItemsCount = useMemo(() => Object.values(selectedItems).length, [selectedItems]);
    const selectionModeEnabled = selectedItemsCount > 0;
    // TODO: Add button to enable selection
    // TODO: Move filter button to grid

    const handleItemClick = (item: Item) => {
        if (selectionModeEnabled) {
            toggleItemSelection(item);
        } else {
            const itemIndex = items.findIndex(i => i === item);
            setPreviewItemIndex(itemIndex);
        }
    }

    const toggleItemSelection = (item: Item) => {
        if (selectedItems[item.itemId]) {
            const newItems = { ...selectedItems };
            delete newItems[item.itemId];

            setSelectedItems(newItems);

        } else {
            setSelectedItems({ ...selectedItems, [item.itemId]: item });
        }
    }

    return (
        <div className='flex flex-auto overflow-hidden relative'>
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
                                        <ItemTile
                                            item={item}
                                            minTileSize={zoomLevel.minTileSize}
                                            onClick={() => handleItemClick(item)}
                                            isSelected={!!selectedItems[item.itemId]}
                                        />
                                    </div>
                                ))}
                            </div>

                        );
                    })}
                </div>
                <GridZoomControl options={zoomControlOptions} onSelect={value => setZoomLevel(value)} value={zoomLevel} />
                <div className='absolute top-4 left-4 text-shadow text-slate-50 font-bold text-2xl drop-shadow select-none pointer-events-none'>
                    {selectionModeEnabled ? `${selectedItemsCount} Selected` : formattedRange}
                </div>
                {previewItem && (
                    <ItemPreview
                        key={previewItem.itemId}
                        item={previewItem}
                        onMovePrevious={() => setPreviewItemIndex(previewItemIndex === 0 ? 0 : previewItemIndex! - 1)}
                        onMoveNext={() => setPreviewItemIndex(previewItemIndex === items.length - 1 ? items.length - 1 : previewItemIndex! + 1)}
                        onClose={() => setPreviewItemIndex(null)}
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

export default ItemGrid;
