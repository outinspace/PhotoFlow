import React, { useRef, useLayoutEffect, useState, useCallback, useMemo, useEffect } from 'react';
import styled from '@emotion/styled';
import { Range, defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { ItemTile } from './item.tile';
import { Item } from '../types';
import ItemPreview from './item.preview';
import { format } from 'date-fns';
import { FilterBar, useFilterBar } from './filter.bar';
import { Filter, Menu, OneFingerSelectHandGesture, Xmark } from 'iconoir-react';
import { ItemActionMenu } from './item.action.menu';
import { ZoomButtons } from './zoom.buttons';

interface Props {
    items: Item[];
    albumId: number | null;
    readonly?: boolean;
}

const ItemGrid = ({ items: allItems, albumId, readonly }: Props) => {
    const [mode, setMode] = useState<'view' | 'filter' | 'select'>('view');

    const { filterProps, filteredItems, resetFilters } = useFilterBar(allItems);
    const items = filteredItems;

    const [previewItemIndex, setPreviewItemIndex] = useState<number | null>(null);
    const previewItem = previewItemIndex === null ? null : items[previewItemIndex];

    const visibleRangeRef = useRef({ startIndex: 0, endIndex: 0 });
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const containerWidth = scrollContainerRef.current?.clientWidth ?? 0;

    const [zoomLevelIndex, setZoomIndex] = useState(2);
    const zoomLevels = [
        {
            idealTileSize: 40,
            overscan: 0
        },
        {
            idealTileSize: 50,
            overscan: 5
        },
        {
            idealTileSize: 70,
            overscan: 20
        },
        {
            idealTileSize: 110,
            overscan: 30
        },
        {
            idealTileSize: Math.min(containerWidth, 300),
            overscan: 40
        }
    ];
    const zoomLevel = zoomLevels[zoomLevelIndex];

    const rangeDateFormat = zoomLevel.idealTileSize >= 50 ? 'MMM d yyyy' : 'MMMM yyyy';

    // TODO: Extract into useTileVirtualizer
    const columns = Math.floor(containerWidth / zoomLevel.idealTileSize);
    const rows = Math.ceil(items.length / columns);
    const tileSize = containerWidth === 0 ? 0 : containerWidth / columns;

    // TODO: Consider using virtualizer grid now that tile images are cached
    const rowVirtualizer = useVirtualizer({
        enabled: tileSize > 0,
        count: rows ?? 0,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: () => tileSize,
        overscan: zoomLevel.overscan,
        paddingEnd: 100,
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
    // END: Extract into useTileVirtualizer

    let formattedRange = useFormattedRange(items, visibleRangeRef.current, columns, rangeDateFormat);

    const { selectedItems, selectedItemsById, toggleItemSelection, resetSelection } = useItemSelection(items);
    const [showActionMenu, setShowActionMenu] = useState(false);

    const handleItemClick = (item: Item) => {
        if (mode === 'select') {
            toggleItemSelection(item);
        } else {
            const itemIndex = items.findIndex(i => i === item);
            setPreviewItemIndex(itemIndex);
        }
    }

    const closeModes = () => {
        resetFilters();
        resetSelection();

        setMode('view');
    }

    const floatingButtonClasses = 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-full p-3 drop-shadow ml-2';

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <div className='flex flex-auto overflow-hidden relative'>
                <div className='absolute bottom-2 right-2 z-10 flex'>
                    {!readonly && mode === 'view' && (
                        <div className={floatingButtonClasses}>
                            <OneFingerSelectHandGesture
                                className='size-6'
                                style={{ marginTop: 2, marginBottom: -2 }}
                                onClick={() => setMode('select')}
                            />
                        </div>
                    )}
                    {!readonly && mode === 'select' && selectedItems.length > 0 && (
                        <div className={floatingButtonClasses}>
                            <Menu
                                className='size-6'
                                style={{ marginTop: 2, marginBottom: -2 }}
                                onClick={() => setShowActionMenu(!showActionMenu)}
                            />
                            {showActionMenu && (
                                <ItemActionMenu
                                    items={selectedItems}
                                    albumId={albumId}
                                    onDismiss={() => setShowActionMenu(false)}
                                    onActionCompleted={() => closeModes()}
                                    position='top'
                                />
                            )}
                        </div>
                    )}
                    {mode === 'view' && (
                        <div className={floatingButtonClasses}>
                            <Filter
                                className='size-6'
                                style={{ marginTop: 2, marginBottom: -2 }}
                                onClick={() => setMode('filter')}
                            />
                        </div>
                    )}
                    {mode !== 'view' && (
                        <div className={floatingButtonClasses}>
                            <Xmark
                                className='size-6'
                                style={{ marginTop: 2, marginBottom: -2 }}
                                onClick={() => closeModes()}
                            />
                        </div>
                    )}
                </div>
                <ScrollContainer ref={scrollContainerRef}>
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
                                                idealTileSize={zoomLevel.idealTileSize}
                                                onClick={() => handleItemClick(item)}
                                                isSelected={!!selectedItemsById[item.itemId]}
                                            />
                                        </div>
                                    ))}
                                </div>

                            );
                        })}
                    </div>
                    <ZoomButtons
                        onZoomOut={() => setZoomIndex(zoomLevelIndex === 0 ? 0 : zoomLevelIndex - 1)}
                        onZoomIn={() => setZoomIndex(zoomLevelIndex === zoomLevels.length - 1 ? zoomLevels.length - 1 : zoomLevelIndex + 1)}
                    />
                    <div className='absolute top-4 left-4 text-shadow text-slate-50  drop-shadow select-none pointer-events-none'>
                        <div className='font-bold text-2xl'>{formattedRange}</div>
                        {mode === 'select' && (
                            <div className='font-bold text-xl'>{selectedItems.length} Items Selected</div>
                        )}
                    </div>
                </ScrollContainer>
            </div>
            {mode === 'filter' && <FilterBar {...filterProps} items={allItems} />}
            {previewItem && (
                <ItemPreview
                    key={previewItem.itemId}
                    readonly={readonly}
                    item={previewItem}
                    albumId={albumId}
                    onMovePrevious={() => setPreviewItemIndex(previewItemIndex === 0 ? 0 : previewItemIndex! - 1)}
                    onMoveNext={() => setPreviewItemIndex(previewItemIndex === items.length - 1 ? items.length - 1 : previewItemIndex! + 1)}
                    onClose={() => setPreviewItemIndex(null)}
                />
            )}
        </div>
    );
}

const ScrollContainer = styled.div`
    flex: 1 1 auto;
    width: 100%;
    overflow-y: scroll;
    overflow-x: hidden;
`;

export default ItemGrid;

function useFormattedRange(items: Item[], visibleRange: { startIndex: number; endIndex: number; }, columns: number, rangeDateFormat: string) {
    const rangeStartItem: Item | undefined = items[visibleRange.startIndex * columns];
    const rangeEndItem: Item | undefined = items[visibleRange.endIndex * columns - 1];

    let formattedRange = '';
    if (rangeStartItem && rangeEndItem) {
        const start = format(rangeStartItem.captureTime, rangeDateFormat);
        formattedRange = start;
    }
    return formattedRange;
}

const keysPressed = new Set();

const handleKeyDown = (e: KeyboardEvent) => {
    keysPressed.add(e.key);
};

const handleKeyUp = (e: KeyboardEvent) => {
    keysPressed.delete(e.key);
};

function useItemSelection(allItems: Item[]) {
    const [selectedItemsById, setSelectedItemsById] = useState<Record<number, Item>>({});
    const selectedItems = useMemo(() => Object.values(selectedItemsById), [selectedItemsById]);
    const lastSelectedItem = useRef<Item | null>(null);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    const toggleItemSelection = (item: Item) => {
        if (selectedItemsById[item.itemId]) {
            const newItems = { ...selectedItemsById };
            delete newItems[item.itemId];

            setSelectedItemsById(newItems);
            lastSelectedItem.current = null;
        } else {
            const newSelectedItemsById = { ...selectedItemsById, [item.itemId]: item };

            // Select range
            if (keysPressed.has('Shift') && lastSelectedItem.current !== null) {
                const index1 = allItems.findIndex(i => i === item);
                const index2 = allItems.findIndex(i => i === lastSelectedItem.current);

                const minIndex = Math.min(index1, index2);
                const maxIndex = Math.max(index1, index2);

                const rangeItems = allItems.slice(minIndex, maxIndex);
                for (const rangeItem of rangeItems) {
                    newSelectedItemsById[rangeItem.itemId] = rangeItem;
                }
            }

            lastSelectedItem.current = item;
            setSelectedItemsById(newSelectedItemsById);
        }
    };

    const resetSelection = () => {
        setSelectedItemsById({});
    };

    return {
        selectedItems,
        selectedItemsById,
        toggleItemSelection,
        resetSelection
    }
}
