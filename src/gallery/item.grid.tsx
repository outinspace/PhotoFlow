import React, { ReactNode, useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { ItemTile } from './item.tile';
import { Item } from '../types';
import ItemPreview from './item.preview';
import { format } from 'date-fns';
import { FilterMenu, useFilterBar, countActiveFilters } from './filter.bar';
import { Filter, NavArrowLeft } from 'iconoir-react';
import { ItemActionMenu } from './item.action.menu';
import { ZoomButtons } from './zoom.buttons';
import { Ellipsis } from '../common/ellipsis';
import { formatBytes } from '../common/format.helpers';
import { useKeyBindings } from '../hooks/use.key.bindings';
import { DeleteItemsModal } from './delete.items.modal';
import { GridGesture, GridLayout, useGridLayout } from './use.grid.layout';
import { anchorScrollTop, computeAnchor, useGridAnchor } from './use.grid.anchor';
import { useGridPinch } from './use.grid.pinch';
import { useItemSelection } from './use.item.selection';
import { readPreviewItemId, usePreviewItem } from './use.preview.item';
import { PREFETCH_AHEAD_ITEMS, setTilesToPrefetch } from '../common/tile.loader';
import { usePrefetchThumbnails } from '../hooks/use.settings';

// Each zoom button tap changes the column count by roughly this factor, so a few taps cross
// the whole range on a phone as well as on a wide desktop.
const ZOOM_STEP = 1.4;

// The map page floats its own controls over the canvas and should look like these.
export const floatingButtonClasses = 'glass flex flex-none size-11 items-center justify-center rounded-full cursor-pointer hover:bg-white/80 active:bg-white';
const floatingPillClasses = 'glass flex flex-none h-11 items-center gap-1.5 px-4 rounded-full text-[15px] font-semibold cursor-pointer hover:bg-white/80 active:bg-white';

interface Props {
    items: Item[];
    albumId: number | null;
    readonly?: boolean;
    disableFilteringSorting?: boolean;
    enableUrlPersistence?: boolean;
    disablePinch?: boolean;
    // Shown large over the top of the photos, with the date of the rows on screen
    // beneath it. Without one, the date takes its place.
    title?: string;
    onBack?: () => void;
    // Extra buttons beside Filter and Select, such as an album's own menu.
    headerActions?: ReactNode;
}

const ItemGrid = ({ items: allItems, albumId, readonly, disableFilteringSorting, enableUrlPersistence = false, disablePinch, title, onBack, headerActions }: Props) => {
    const [filterBarVisible, setFilterBarVisible] = useState(false);
    const [selectModeEnabled, setSelectModeEnabled] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const clickTimerRef = useRef<number | null>(null);

    const { filterProps, filteredItems } = useFilterBar(allItems, enableUrlPersistence);
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

    // What to read ahead once the screen itself is served: the photos just after the
    // ones on show, in the order the gallery will reach them.
    const [prefetchEnabled] = usePrefetchThumbnails();
    const firstVisibleIndex = layout.firstVisibleRow * layout.columns;

    // A video in the preview needs a sustained read from the same handful of
    // connections the thumbnails queue on, and unlike an <img> its request carries
    // no priority the page can lower. So reading ahead stands down for one. A photo
    // is a single request that is over in a moment, and reading ahead while one is
    // being looked at is exactly what should be happening.
    const previewingVideo = previewItemIndex !== null && items[previewItemIndex]?.type === 'video';

    useEffect(() => {
        if (!prefetchEnabled || previewingVideo) {
            setTilesToPrefetch([]);
            return;
        }

        const sources: string[] = [];
        const until = Math.min(items.length, firstVisibleIndex + PREFETCH_AHEAD_ITEMS);
        for (let index = firstVisibleIndex; index < until; index++) {
            const source = items[index]?.primaryFile.tileImageSource;
            if (source) {
                sources.push(source);
            }
        }

        setTilesToPrefetch(sources);

        // Navigating away from the grid stops it too: the grid stays mounted behind
        // a preview, so nothing else would.
        return () => setTilesToPrefetch([]);
    }, [items, firstVisibleIndex, prefetchEnabled, previewingVideo]);

    useGridAnchor({
        items,
        layout,
        // Read straight from the URL, so a preview opened later in the session doesn't count.
        fallbackItemId: enableUrlPersistence ? readPreviewItemId() : null,
        enableUrlPersistence
    });

    useGridPinch({
        scrollContainerRef,
        contentRef: rowsRef,
        layout,
        itemCount: items.length,
        setGesture,
        enabled: !disablePinch && previewItemIndex === null
    });

    const zoomTo = (targetColumns: number) => {
        const columns = layout.snapColumns(targetColumns);
        if (columns === layout.columns) return;

        const scrollTop = scrollContainerRef.current!.scrollTop;
        const anchor = computeAnchor(layout, scrollTop, layout.containerWidth / 2, layout.containerHeight / 2, items.length);
        layout.setColumns(columns, (tileSize, newColumns) => anchorScrollTop(anchor, tileSize, newColumns));
    };

    // Fewer columns means bigger tiles. Stepping past the neighbouring odd count keeps a tap
    // moving even where rounding alone wouldn't.
    const zoomIn = () => zoomTo(Math.min(layout.columns - 2, Math.round(layout.columns / ZOOM_STEP)));
    const zoomOut = () => zoomTo(Math.max(layout.columns + 2, Math.round(layout.columns * ZOOM_STEP)));

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

    useEffect(() => {
        return () => {
            if (clickTimerRef.current) {
                clearTimeout(clickTimerRef.current);
            }
        };
    }, []);

    const handleReturnToTopClick = (event: React.MouseEvent<HTMLDivElement>) => {
        // The header's buttons sit in that strip too, and a tap on one is not a
        // request to go back to the top.
        if ((event.target as HTMLElement).closest('[data-grid-header]')) return;

        const threshold = 30; // pixels from the top
        const clickPosition = event.clientY - scrollContainerRef.current!.getBoundingClientRect().top;
        if (clickPosition <= threshold) {
            scrollContainerRef.current!.scrollTo({ top: 0, behavior: 'smooth' });
            event.stopPropagation();
        }
    };

    // One flat list of tiles, positioned individually and keyed by item. Keeping the key stable
    // across layout changes makes React move each existing element — and its already-decoded
    // image — to its new spot when the column count changes, instead of remounting everything,
    // which flashes every tile's dark placeholder on iOS while the images decode again.
    const tiles = [];
    for (let row = layout.firstRenderedRow; row <= layout.lastRenderedRow; row++) {
        const rowStart = row * layout.columns;
        // While a pinch is scaling the rows down, each one is extended past its own columns so
        // the space either side is filled rather than left empty. Those edge fillers duplicate
        // items from the neighbouring rows, so they get row-scoped keys of their own.
        const from = Math.max(0, rowStart - layout.extraTilesLeft);
        const to = Math.min(items.length, rowStart + layout.columns + layout.extraTilesRight);
        for (let index = from; index < to; index++) {
            const item = items[index];
            const inRow = index >= rowStart && index < rowStart + layout.columns;
            tiles.push(
                <div
                    key={inRow ? item.itemId : `${row}:${item.itemId}`}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: `${layout.tileSize}px`,
                        width: `${layout.tileSize}px`,
                        transform: `translate(${(index - rowStart) * layout.tileSize}px, ${row * layout.tileSize}px)`,
                        contain: 'layout',
                    }}
                >
                    <ItemTile
                        item={item}
                        tileSize={layout.tileSize}
                        onClick={handleItemClick}
                        isSelected={!!selectedItemsById[item.itemId]}
                    />
                </div>
            );
        }
    }

    const activeFilterCount = countActiveFilters(filterProps.filters);
    const heading = selectModeEnabled
        ? `${selectedItems.length} Selected`
        : title ?? (disableFilteringSorting ? '' : formattedRange);
    // White text over a scrim reads on photos, but a short album leaves the header
    // over the empty page, where the scrim is a grey smear and dark text is needed.
    const headerOverPhotos = layout.rowCount * layout.tileSize >= 144;
    const subheading = selectModeEnabled
        ? formatBytes(selectedBytes)
        : title && !disableFilteringSorting ? formattedRange : '';

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <div className='flex flex-auto overflow-hidden relative' onClickCapture={handleReturnToTopClick}>
                {/* The photos run under the header, so a scrim keeps its white text
                    readable over a bright sky. */}
                {headerOverPhotos && (
                    <div aria-hidden className='absolute inset-x-0 top-0 z-10 h-36 bg-gradient-to-b from-black/45 to-transparent pointer-events-none' />
                )}
                <div data-grid-header className='absolute inset-x-0 top-0 z-10 flex items-start gap-3 px-4 pt-3 pointer-events-none'>
                    {onBack && (
                        <button
                            className={`${floatingButtonClasses} pointer-events-auto`}
                            onClick={onBack}
                            title='Back'
                            aria-label='Back'
                        >
                            <NavArrowLeft className='size-6' />
                        </button>
                    )}
                    <div className={`flex-auto min-w-0 pt-0.5 select-none ${headerOverPhotos ? 'text-white' : 'text-slate-900'}`}>
                        <div className={`text-[28px] leading-9 font-bold tracking-tight truncate ${headerOverPhotos ? '[text-shadow:0_1px_12px_rgb(0_0_0/0.35)]' : ''}`}>{heading}</div>
                        {subheading && (
                            <div className={`text-[13px] font-semibold opacity-95 truncate ${headerOverPhotos ? '[text-shadow:0_1px_8px_rgb(0_0_0/0.4)]' : ''}`}>{subheading}</div>
                        )}
                    </div>
                    <div className='flex flex-none items-center gap-2 pointer-events-auto'>
                        {!selectModeEnabled && headerActions}
                        {!selectModeEnabled && !disableFilteringSorting && (
                            <div className='relative'>
                                <button
                                    className={`${floatingButtonClasses} relative`}
                                    onClick={() => setFilterBarVisible(true)}
                                    title='Filter & sort'
                                    aria-label='Filter & sort'
                                >
                                    <Filter className='size-5' />
                                    {activeFilterCount > 0 && (
                                        <div className='absolute -top-1 -right-1 bg-sky-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1'>
                                            {activeFilterCount}
                                        </div>
                                    )}
                                </button>
                                <FilterMenu
                                    items={allItems}
                                    filters={filterProps.filters}
                                    setFilters={filterProps.setFilters}
                                    isOpen={filterBarVisible}
                                    onDismiss={() => setFilterBarVisible(false)}
                                />
                            </div>
                        )}
                        <button
                            className={floatingPillClasses}
                            onClick={() => selectModeEnabled ? closeSelectionMode() : setSelectModeEnabled(true)}
                        >
                            {selectModeEnabled ? 'Done' : 'Select'}
                        </button>
                    </div>
                </div>

                {/* Above the phone's tab bar, and in the corner on desktop. */}
                <div className='absolute right-4 z-10 flex gap-2' style={{ bottom: 'calc(var(--tabbar-space) + 12px)' }}>
                    {selectModeEnabled && selectedItems.length > 0 && (
                        <>
                            <button
                                className={floatingPillClasses}
                                onClick={() => setShowActionMenu(!showActionMenu)}
                                title='Actions'
                                aria-label='Actions'
                            >
                                Actions
                                <Ellipsis className='size-5' />
                            </button>
                            <ItemActionMenu
                                items={selectedItems}
                                albumId={albumId}
                                isOpen={showActionMenu}
                                onDismiss={() => setShowActionMenu(false)}
                                onActionCompleted={() => closeSelectionMode()}
                                position='top'
                                readonly={!!readonly}
                            />
                        </>
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
                            {tiles}
                        </div>
                    </div>
                </div>
                {/* A phone pinches instead. */}
                <div className='hidden md:flex absolute bottom-4 left-4 z-10'>
                    <ZoomButtons
                        onZoomOut={zoomOut}
                        onZoomIn={zoomIn}
                        zoomInDisabled={layout.columns === layout.minColumns}
                        zoomOutDisabled={layout.columns === layout.maxColumns}
                    />
                </div>
            </div>
            {previewItemIndex !== null && (
                <ItemPreview
                    readonly={readonly}
                    items={items}
                    itemIndex={previewItemIndex}
                    albumId={albumId}
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

    // Its captureTime is the upload time standing in for the date it does not
    // have, and dating the row by that would be a lie about the photo.
    if (!rangeStartItem.hasCaptureDate) {
        return 'No date';
    }

    return format(rangeStartItem.captureTime, rangeDateFormat);
}
