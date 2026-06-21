import React, { useRef, useLayoutEffect, useState, useCallback, useMemo, useEffect } from 'react';
import styled from '@emotion/styled';
import { Range, defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { ItemTile } from './item.tile';
import { Item } from '../types';
import ItemPreview from './item.preview';
import { format } from 'date-fns';
import { FilterSheet, useFilterBar, countActiveFilters } from './filter.bar';
import { Filter, CheckCircle, Xmark } from 'iconoir-react';
import { ItemActionMenu } from './item.action.menu';
import { ZoomButtons } from './zoom.buttons';
import { Ellipsis } from '../common/ellipsis';
import { formatBytes } from '../common/format.helpers';
import { useKeyBindings } from '../hooks/use.key.bindings';
import { DeleteItemsModal } from './delete.items.modal';

interface Props {
    items: Item[];
    albumId: number | null;
    readonly?: boolean;
    disableFilteringSorting?: boolean;
    enableUrlPersistence?: boolean;
    tenantId?: string;
}

const ItemGrid = ({ items: allItems, albumId, readonly, disableFilteringSorting, enableUrlPersistence = false, tenantId }: Props) => {
    const [filterBarVisible, setFilterBarVisible] = useState(false);
    const [selectModeEnabled, setSelectModeEnabled] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const clickTimerRef = useRef<number | null>(null);

    const { filterProps, filteredItems } = useFilterBar(allItems);
    const items = disableFilteringSorting ? allItems : filteredItems;

    // Unified preview state management
    const [localPreviewItemId, setLocalPreviewItemId] = useState<number | null>(() => {
        if (!enableUrlPersistence) return null;
        const urlParams = new URLSearchParams(window.location.search);
        const previewItemId = urlParams.get('previewItemId');
        return previewItemId ? parseInt(previewItemId, 10) : null;
    });

    const setPreviewItemId = useCallback((itemId: number | null, replace: boolean = false) => {
        setLocalPreviewItemId(itemId);
        
        if (enableUrlPersistence) {
            const url = new URL(window.location.href);
            if (itemId === null) {
                url.searchParams.delete('previewItemId');
            } else {
                url.searchParams.set('previewItemId', itemId.toString());
            }
            
            if (replace) {
                window.history.replaceState({}, '', url.toString());
            } else {
                window.history.pushState({}, '', url.toString());
            }
        }
    }, [enableUrlPersistence]);
    
    const previewItemIndex = useMemo(() => {
        if (localPreviewItemId === null) return null;
        const index = items.findIndex(item => item.itemId === localPreviewItemId);
        return index >= 0 ? index : null;
    }, [localPreviewItemId, items]);

    // Listen for URL changes (back/forward navigation) only when URL persistence is enabled
    useEffect(() => {
        if (!enableUrlPersistence) return;
        
        const handlePopState = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const previewItemId = urlParams.get('previewItemId');
            setLocalPreviewItemId(previewItemId ? parseInt(previewItemId, 10) : null);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [enableUrlPersistence]);

    const visibleRangeRef = useRef({ startIndex: 0, endIndex: 0 });
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const containerWidth = scrollContainerRef.current?.clientWidth ?? 0;

    const [zoomLevelIndex, setZoomIndex] = useState(() => {
        const baseIndex = 2;
        const baseTileSize = 70;
        const threshold = 300;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const cols = Math.max(1, Math.floor(w / baseTileSize));
        const tile = w / cols;
        const rows = Math.ceil(h / tile);
        const visible = cols * rows;

        return visible > threshold ? Math.min(baseIndex + 1, 4) : baseIndex;
    });
    const zoomLevels = [
        {
            idealTileSize: 40,
            overscanRows: 4
        },
        {
            idealTileSize: 50,
            overscanRows: 6
        },
        {
            idealTileSize: 70,
            overscanRows: 10
        },
        {
            idealTileSize: 110,
            overscanRows: 10
        },
        {
            idealTileSize: Math.min(containerWidth, 300),
            overscanRows: 10
        }
    ];
    const zoomLevel = zoomLevels[zoomLevelIndex];

    const rangeDateFormat = zoomLevel.idealTileSize >= 50 ? 'MMM d yyyy' : 'MMMM yyyy';

    const columns = Math.max(1, Math.floor(containerWidth / zoomLevel.idealTileSize));
    const tileSize = containerWidth === 0 ? 0 : containerWidth / columns;

    // Virtualize rows (each holds `columns` tiles) instead of using TanStack's `lanes`
    // masonry path — for a uniform grid lanes makes measurement scale with count × columns
    // (getFurthestMeasurement), which dominated the CPU profile. lanes=1 is O(1) per row.
    const rowCount = Math.ceil(items.length / columns);

    const rowVirtualizer = useVirtualizer({
        enabled: tileSize > 0,
        count: rowCount,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: () => tileSize,
        overscan: zoomLevel.overscanRows,
        paddingEnd: 100,
        rangeExtractor: useCallback((range: Range) => {
            // range is in row indices here.
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


    const zoomOut = () => {
        setZoomIndex(zoomLevelIndex === 0 ? 0 : zoomLevelIndex - 1);
        rowVirtualizer.measure();
    }

    const zoomIn = () => {
        setZoomIndex(zoomLevelIndex === zoomLevels.length - 1 ? zoomLevels.length - 1 : zoomLevelIndex + 1);
        rowVirtualizer.measure();
    }

    const sort = disableFilteringSorting ? 'capture-date' : filterProps.filters.sort;
    let formattedRange = useFormattedRange(items, visibleRangeRef.current, columns, rangeDateFormat, sort);

    const { selectedItems, selectedItemsById, toggleItemSelection, resetSelection } = useItemSelection(items);
    const [showActionMenu, setShowActionMenu] = useState(false);

    const selectedBytes = useMemo(() => {
        return selectedItems.reduce((sum, item) => sum + item.totalBytes, 0);
    }, [selectedItems]);

    useKeyBindings([
        { cmd: ['d'], callback: () => selectedItems.length > 0 && setShowDeleteModal(true) },
        { cmd: ['Escape'], callback: () => {
            if (showDeleteModal) {
                setShowDeleteModal(false);
            } else if (selectModeEnabled) {
                closeSelectionMode();
            }
        }}
    ], [selectedItems, showDeleteModal, selectModeEnabled]);

    // Keep a ref so handleItemClick can stay referentially stable (it's passed to every
    // memoized tile) without going stale on the latest select-mode value.
    const selectModeEnabledRef = useRef(selectModeEnabled);
    selectModeEnabledRef.current = selectModeEnabled;

    const handleItemClick = useCallback((item: Item, isDoubleClick: boolean) => {
        if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
            // Handle double click - start selection mode
            setSelectModeEnabled(true);
            toggleItemSelection(item, false);
        } else if (selectModeEnabledRef.current) {
            // Already in selection mode, handle selection immediately
            toggleItemSelection(item, isDoubleClick);
        } else {
            // Set timer for single click to handle preview
            clickTimerRef.current = window.setTimeout(() => {
                clickTimerRef.current = null;
                setPreviewItemId(item.itemId, false);
            }, 250); // 250ms delay to detect double click
        }
    }, [toggleItemSelection, setPreviewItemId]);

    const closeSelectionMode = () => {
        resetSelection();

        setShowActionMenu(false);
        setSelectModeEnabled(false);
    }

    const floatingButtonClasses = 'backdrop-blur-2xl bg-white/60 border border-white/20 rounded-full p-3 shadow-lg hover:bg-white/50 active:bg-white/50 ml-2 cursor-pointer';

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (clickTimerRef.current) {
                clearTimeout(clickTimerRef.current);
            }
        };
    }, []);

    const handleReturnToTopClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const threshold = 30; // pixels from the top
        const clickPosition = event.clientY - scrollContainerRef.current!.getBoundingClientRect().top;
        if (clickPosition <= threshold) {
            scrollContainerRef.current!.scrollTo({ top: 0, behavior: 'smooth' });
            event.stopPropagation();
        }
    };

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <div className='flex flex-auto overflow-hidden relative' onClickCapture={handleReturnToTopClick}>
                <div className='absolute bottom-2 right-2 z-10 flex'>
                    {!selectModeEnabled && (
                        <button
                            className={`${floatingButtonClasses} flex items-center gap-1.5`}
                            onClick={() => setSelectModeEnabled(true)}
                            title='Select photos'
                            aria-label='Select photos'
                        >
                            <CheckCircle
                                className='size-6 drop-shadow-sm'
                                style={{ marginTop: 2, marginBottom: -2 }}
                            />
                            <span className='text-sm font-medium pr-1'>Select</span>
                        </button>
                    )}
                    {selectModeEnabled && selectedItems.length > 0 && (
                        <>
                            <button
                                className={floatingButtonClasses}
                                onClick={() => setShowActionMenu(!showActionMenu)}
                                title='Actions'
                                aria-label='Actions'
                            >
                                <Ellipsis
                                    className='size-6 drop-shadow-sm'
                                    style={{ marginTop: 2, marginBottom: -2 }}
                                />
                            </button>
                            <ItemActionMenu
                                items={selectedItems}
                                albumId={albumId}
                                isOpen={showActionMenu}
                                onDismiss={() => setShowActionMenu(false)}
                                onActionCompleted={() => closeSelectionMode()}
                                position='top'
                                readonly={!!readonly}
                                tenantId={tenantId}
                            />
                        </>
                    )}
                    {selectModeEnabled && (
                        <button
                            className={floatingButtonClasses}
                            onClick={() => closeSelectionMode()}
                            title='Cancel selection'
                            aria-label='Cancel selection'
                        >
                            <Xmark
                                className='size-6 drop-shadow-sm'
                                style={{ marginTop: 2, marginBottom: -2 }}
                            />
                        </button>
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
                            const startIndex = virtualRow.index * columns;
                            const rowItems = items.slice(startIndex, startIndex + columns);
                            return (
                                <div
                                    key={virtualRow.key}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        height: `${tileSize}px`,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                        display: 'flex',
                                        contain: 'layout',
                                    }}
                                >
                                    {rowItems.map((item) => (
                                        <div
                                            key={item.itemId}
                                            style={{
                                                height: `${tileSize}px`,
                                                width: `${tileSize}px`,
                                                flex: '0 0 auto',
                                            }}
                                        >
                                            <ItemTile
                                                item={item}
                                                idealTileSize={zoomLevel.idealTileSize}
                                                onClick={handleItemClick}
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
                            onZoomOut={zoomOut}
                            onZoomIn={zoomIn}
                        />
                        {!disableFilteringSorting && (
                            <button
                                className={`${floatingButtonClasses} relative`}
                                onClick={() => setFilterBarVisible(true)}
                                title='Filter & sort'
                                aria-label='Filter & sort'
                            >
                                <Filter
                                    className='size-6 drop-shadow-sm'
                                    style={{ marginTop: 2, marginBottom: -2 }}
                                />
                                {countActiveFilters(filterProps.filters) > 0 && (
                                    <div className='absolute -top-1 -right-1 bg-sky-500 text-white text-xs font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1'>
                                        {countActiveFilters(filterProps.filters)}
                                    </div>
                                )}
                            </button>
                        )}
                    </div>

                    <div className='absolute top-4 left-4 text-shadow text-slate-50 drop-shadow select-none pointer-events-none'>
                        {!disableFilteringSorting && <div className='font-bold text-2xl'>{formattedRange}</div>}
                        {selectModeEnabled && (
                            <div className='font-bold text-l'>
                                {selectedItems.length} Items Selected • {formatBytes(selectedBytes)}
                            </div>
                        )}
                    </div>
                </ScrollContainer>
            </div>
            {!disableFilteringSorting && (
                <FilterSheet
                    items={allItems}
                    filters={filterProps.filters}
                    setFilters={filterProps.setFilters}
                    isOpen={filterBarVisible}
                    onDismiss={() => setFilterBarVisible(false)}
                />
            )}
            {previewItemIndex !== null && (
                <ItemPreview
                    readonly={readonly}
                    items={items}
                    itemIndex={previewItemIndex}
                    albumId={albumId}
                    tenantId={tenantId}
                    onMovePrevious={() => {
                        const newIndex = previewItemIndex === 0 ? items.length - 1 : previewItemIndex - 1;
                        const newItem = items[newIndex];
                        if (newItem) {
                            setPreviewItemId(newItem.itemId, true);
                        }
                    }}
                    onMoveNext={() => {
                        const newIndex = previewItemIndex === items.length - 1 ? 0 : previewItemIndex + 1;
                        const newItem = items[newIndex];
                        if (newItem) {
                            setPreviewItemId(newItem.itemId, true);
                        }
                    }}
                    onClose={() => {
                        setPreviewItemId(null, true);
                    }}
                />
            )}
            <DeleteItemsModal
                isOpen={showDeleteModal}
                onCancel={() => setShowDeleteModal(false)}
                onDeleteComplete={() => {
                    setShowDeleteModal(false);
                    closeSelectionMode();
                }}
                items={selectedItems}
            />
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

function useFormattedRange(items: Item[], visibleRange: { startIndex: number; endIndex: number; }, columns: number, rangeDateFormat: string, sort: string) {
    if (!columns) return '';
    // visibleRange is in row indices; convert to item indices.
    const startItemIndex = visibleRange.startIndex * columns;
    const endItemIndex = Math.min(items.length, (visibleRange.endIndex + 1) * columns) - 1;
    const rangeStartItem: Item | undefined = items[startItemIndex];
    const rangeEndItem: Item | undefined = items[endItemIndex];

    let formattedRange = '';
    if (rangeStartItem && rangeEndItem) {
        if (sort === 'upload-date') {
            const start = format(rangeStartItem.primaryFile.uploadTimeUtc, rangeDateFormat);
            formattedRange = `Uploaded ${start}`;
        } else {
            formattedRange = format(rangeStartItem.captureTime, rangeDateFormat);
        }
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

    // Refs let toggleItemSelection stay referentially stable (it reaches every memoized
    // tile via handleItemClick) while still reading the latest selection / item list.
    const selectedItemsByIdRef = useRef(selectedItemsById);
    selectedItemsByIdRef.current = selectedItemsById;
    const allItemsRef = useRef(allItems);
    allItemsRef.current = allItems;

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    const toggleItemSelection = useCallback((item: Item, isDoubleClick: boolean) => {
        const selectedItemsById = selectedItemsByIdRef.current;
        const allItems = allItemsRef.current;
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
    }, []);

    const resetSelection = useCallback(() => {
        setSelectedItemsById({});
    }, []);

    return {
        selectedItems,
        selectedItemsById,
        toggleItemSelection,
        resetSelection
    }
}
