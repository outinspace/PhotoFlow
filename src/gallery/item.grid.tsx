import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
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
import { GridGesture, GridLayout, clamp, useGridLayout } from './use.grid.layout';
import { computeAnchor, useGridAnchor } from './use.grid.anchor';
import { useGridPinch } from './use.grid.pinch';
import { useItemSelection } from './use.item.selection';
import { readPreviewItemId, usePreviewItem } from './use.preview.item';

// Each zoom button tap changes the column count by roughly this factor, so a few taps cross
// the whole range on a phone as well as on a wide desktop.
const ZOOM_STEP = 1.4;

interface Props {
    items: Item[];
    albumId: number | null;
    readonly?: boolean;
    disableFilteringSorting?: boolean;
    enableUrlPersistence?: boolean;
    disablePinch?: boolean;
    tenantId?: string;
}

const ItemGrid = ({ items: allItems, albumId, readonly, disableFilteringSorting, enableUrlPersistence = false, disablePinch, tenantId }: Props) => {
    const [filterBarVisible, setFilterBarVisible] = useState(false);
    const [selectModeEnabled, setSelectModeEnabled] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const clickTimerRef = useRef<number | null>(null);

    const { filterProps, filteredItems } = useFilterBar(allItems);
    const items = disableFilteringSorting ? allItems : filteredItems;

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const rowsRef = useRef<HTMLDivElement>(null);

    const { previewItemId, setPreviewItemId } = usePreviewItem(enableUrlPersistence);

    const previewItemIndex = useMemo(() => {
        if (previewItemId === null) return null;
        const index = items.findIndex(item => item.itemId === previewItemId);
        return index >= 0 ? index : null;
    }, [previewItemId, items]);

    // Set while a pinch is scaling the rows, so the grid knows how far past the viewport it has
    // to render to keep the edges filled.
    const [gesture, setGesture] = useState<GridGesture | null>(null);

    const layout = useGridLayout(scrollContainerRef, items.length, gesture);

    const reanchor = useGridAnchor({
        items,
        layout,
        // Read straight from the URL, so a preview opened later in the session doesn't count.
        fallbackItemId: enableUrlPersistence ? readPreviewItemId() : null,
        enableUrlPersistence
    });

    // Declared after useGridAnchor, which owns moving the anchored item back into place.
    useGridPinch({
        scrollContainerRef,
        contentRef: rowsRef,
        layout,
        itemCount: items.length,
        reanchor,
        setGesture,
        enabled: !disablePinch && previewItemIndex === null
    });

    const zoomTo = (targetColumns: number) => {
        const columns = clamp(targetColumns, layout.minColumns, layout.maxColumns);
        if (columns === layout.columns) return;

        const scrollTop = scrollContainerRef.current!.scrollTop;
        reanchor(computeAnchor(layout, scrollTop, layout.containerWidth / 2, layout.containerHeight / 2, items.length));
        layout.setColumns(columns);
    };

    // Fewer columns means bigger tiles. Stepping past the neighbouring count keeps a tap
    // moving even where rounding alone wouldn't.
    const zoomIn = () => zoomTo(Math.min(layout.columns - 1, Math.round(layout.columns / ZOOM_STEP)));
    const zoomOut = () => zoomTo(Math.max(layout.columns + 1, Math.round(layout.columns * ZOOM_STEP)));

    const sort = disableFilteringSorting ? 'capture-date' : filterProps.filters.sort;
    const formattedRange = formatVisibleRange(items, layout, sort);

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

    const rows = [];
    for (let row = layout.firstRenderedRow; row <= layout.lastRenderedRow; row++) {
        const startIndex = row * layout.columns;
        // While a pinch is scaling the rows down, each one is extended past its own columns so the
        // space either side is filled rather than left empty. The extra tiles are the items that
        // neighbour the row in the list, so it reads as more of the same grid.
        const from = Math.max(0, startIndex - layout.extraTilesLeft);
        rows.push(
            <div
                key={row}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: `${layout.tileSize}px`,
                    width: '100%',
                    transform: `translate(${(from - startIndex) * layout.tileSize}px, ${row * layout.tileSize}px)`,
                    display: 'flex',
                    contain: 'layout',
                }}
            >
                {items.slice(from, startIndex + layout.columns + layout.extraTilesRight).map((item) => (
                    <div
                        key={item.itemId}
                        style={{
                            height: `${layout.tileSize}px`,
                            width: `${layout.tileSize}px`,
                            flex: '0 0 auto',
                        }}
                    >
                        <ItemTile
                            item={item}
                            tileSize={layout.tileSize}
                            onClick={handleItemClick}
                            isSelected={!!selectedItemsById[item.itemId]}
                        />
                    </div>
                ))}
            </div>
        );
    }

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
                {/* touch-pan-y leaves one-finger panning to the browser while reserving
                    pinches for the grid's own zoom, so pinching here never zooms the page. */}
                <div ref={scrollContainerRef} className='flex-auto w-full overflow-y-scroll overflow-x-hidden touch-pan-y'>
                    <div
                        style={{
                            height: `${layout.contentHeight}px`,
                            width: '100%',
                            position: 'relative'
                        }}
                    >
                        {/* The rows sit in a layer of their own so a pinch can scale them
                            without changing the scrollable height, which would otherwise
                            fight the scroll position mid-gesture. */}
                        <div ref={rowsRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%' }}>
                            {rows}
                        </div>
                    </div>
                    <div className='flex absolute bottom-2 left-2'>
                        <ZoomButtons
                            onZoomOut={zoomOut}
                            onZoomIn={zoomIn}
                            zoomInDisabled={layout.columns === layout.minColumns}
                            zoomOutDisabled={layout.columns === layout.maxColumns}
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
                </div>
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

export default ItemGrid;

function formatVisibleRange(items: Item[], layout: GridLayout, sort: string) {
    const rangeStartItem: Item | undefined = items[layout.firstVisibleRow * layout.columns];
    if (!rangeStartItem) return '';

    // Narrow tiles don't leave room for a day.
    const rangeDateFormat = layout.tileSize >= 50 ? 'MMM d yyyy' : 'MMMM yyyy';

    if (sort === 'upload-date') {
        return `Uploaded ${format(rangeStartItem.primaryFile.uploadTimeUtc, rangeDateFormat)}`;
    }

    return format(rangeStartItem.captureTime, rangeDateFormat);
}
