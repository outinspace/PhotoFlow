import React, { useRef, useLayoutEffect, useState, useCallback, useMemo, useEffect } from 'react';
import styled from '@emotion/styled';
import { Range, defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { ItemTile } from './item.tile';
import { Item } from '../types';
import ItemPreview from './item.preview';
import { differenceInSeconds, format } from 'date-fns';
import { FilterBar, useFilterBar } from './filter.bar';
import { Filter, Menu, OneFingerSelectHandGesture, Xmark } from 'iconoir-react';
import { ItemActionMenu } from './item.action.menu';
import { ZoomButtons } from './zoom.buttons';
import { Ellipsis } from '../common/ellipsis';

interface Props {
    items: Item[];
    albumId: number | null;
    readonly?: boolean;
}

const ItemGrid = ({ items: allItems, albumId, readonly }: Props) => {
    const [filterBarVisible, setFilterBarVisible] = useState(false);
    const [selectModeEnabled, setSelectModeEnabled] = useState(false);

    const { filterProps, filteredItems, resetFilters } = useFilterBar(allItems);

    const items = useMemo(() => {
        if (filteredItems.length === 0) {
            return [];
        }

        const output: Item[] = [];

        let currentStack: Item = filteredItems[0];
        output.push(filteredItems[0]);

        for (const item of filteredItems) {
            if (Math.abs(differenceInSeconds(currentStack.captureTime, item.captureTime)) < 30) {
                // TODO: nest
            } else {
                currentStack = item;
                output.push(item);
            }
        }

        return output;
    }, [filteredItems]);

    const [previewItemIndex, setPreviewItemIndex] = useState<number | null>(null);

    const visibleRangeRef = useRef({ startIndex: 0, endIndex: 0 });
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const containerWidth = scrollContainerRef.current?.clientWidth ?? 0;

    const [zoomLevelIndex, setZoomIndex] = useState(2);
    const zoomLevels = [
        {
            idealTileSize: 40,
            overscan: 5
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

    const handleItemClick = (item: Item, isDoubleClick: boolean) => {
        if (selectModeEnabled) {
            toggleItemSelection(item, isDoubleClick);
        } else {
            const itemIndex = items.findIndex(i => i === item);
            setPreviewItemIndex(itemIndex);
        }
    }

    const closeSelectionMode = () => {
        resetSelection();

        setShowActionMenu(false);
        setSelectModeEnabled(false);
    }

    const floatingButtonClasses = 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-full p-3 drop-shadow ml-2';

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <div className='flex flex-auto overflow-hidden relative'>
                <div className='absolute bottom-2 right-2 z-10 flex'>
                    {!readonly && !selectModeEnabled && (
                        <div
                            className={floatingButtonClasses}
                            onClick={() => setSelectModeEnabled(true)}
                        >
                            <OneFingerSelectHandGesture
                                className='size-6'
                                style={{ marginTop: 2, marginBottom: -2 }}
                            />
                        </div>
                    )}
                    {!readonly && selectModeEnabled && selectedItems.length > 0 && (
                        <>
                            <div
                                className={floatingButtonClasses}
                                onClick={() => setShowActionMenu(!showActionMenu)}
                            >
                                <Ellipsis
                                    className='size-6'
                                    style={{ marginTop: 2, marginBottom: -2 }}
                                />
                            </div>
                            <ItemActionMenu
                                items={selectedItems}
                                albumId={albumId}
                                isOpen={showActionMenu}
                                onDismiss={() => setShowActionMenu(false)}
                                onActionCompleted={() => closeSelectionMode()}
                                position='top'
                            />
                        </>
                    )}
                    {selectModeEnabled && (
                        <div
                            className={floatingButtonClasses}
                            onClick={() => closeSelectionMode()}
                        >
                            <Xmark
                                className='size-6'
                                style={{ marginTop: 2, marginBottom: -2 }}
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
                                                onClick={(isDoubleClick) => handleItemClick(item, isDoubleClick)}
                                                isSelected={!!selectedItemsById[item.itemId]}
                                            />
                                        </div>
                                    ))}
                                </div>

                            );
                        })}
                    </div>
                    <div className='flex absolute bottom-2 left-2'>
                        <ZoomButtons
                            onZoomOut={() => setZoomIndex(zoomLevelIndex === 0 ? 0 : zoomLevelIndex - 1)}
                            onZoomIn={() => setZoomIndex(zoomLevelIndex === zoomLevels.length - 1 ? zoomLevels.length - 1 : zoomLevelIndex + 1)}
                        />
                        {!filterBarVisible && (
                            <div
                                className={floatingButtonClasses}
                                onClick={() => setFilterBarVisible(true)}
                            >
                                <Filter
                                    className='size-6'
                                    style={{ marginTop: 2, marginBottom: -2 }}
                                />
                            </div>
                        )}
                        {filterBarVisible && (
                            <div
                                className={floatingButtonClasses}
                                onClick={() => {
                                    resetFilters();
                                    setFilterBarVisible(false);
                                }}
                            >
                                <Xmark
                                    className='size-6'
                                    style={{ marginTop: 2, marginBottom: -2 }}
                                />
                            </div>
                        )}
                    </div>
                    <div className='absolute top-4 left-4 text-shadow text-slate-50  drop-shadow select-none pointer-events-none'>
                        <div className='font-bold text-2xl'>{formattedRange}</div>
                        {selectModeEnabled && (
                            <div className='font-bold text-xl'>{selectedItems.length} Items Selected</div>
                        )}
                    </div>
                </ScrollContainer>
            </div>
            {filterBarVisible && <FilterBar {...filterProps} items={allItems} />}
            {previewItemIndex !== null && (
                <ItemPreview
                    readonly={readonly}
                    items={items}
                    itemIndex={previewItemIndex}
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

    const lastLastSelectedItem = useRef<Item | null>(null);
    const lastSelectedItem = useRef<Item | null>(null);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    const toggleItemSelection = (item: Item, isDoubleClick: boolean) => {
        if (!isDoubleClick && selectedItemsById[item.itemId]) {
            const newItems = { ...selectedItemsById };
            delete newItems[item.itemId];

            setSelectedItemsById(newItems);
            lastSelectedItem.current = null;
        } else {
            const newSelectedItemsById = { ...selectedItemsById, [item.itemId]: item };

            const lastSelection = item === lastSelectedItem.current ? lastLastSelectedItem.current : lastSelectedItem.current;

            // Select range
            if ((isDoubleClick || keysPressed.has('Shift')) && lastSelection) {
                const index1 = allItems.findIndex(i => i === item);
                const index2 = allItems.findIndex(i => i === lastSelection);

                const minIndex = Math.min(index1, index2);
                const maxIndex = Math.max(index1, index2);

                const rangeItems = allItems.slice(minIndex, maxIndex);
                for (const rangeItem of rangeItems) {
                    newSelectedItemsById[rangeItem.itemId] = rangeItem;
                }
            }

            lastLastSelectedItem.current = lastSelectedItem.current;
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
