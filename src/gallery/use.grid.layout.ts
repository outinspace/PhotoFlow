import { RefObject, useCallback, useLayoutEffect, useState } from 'react';
import { useGridColumns } from '../hooks/use.settings';

// Tiles are square and together fill the container width exactly, so the container size and
// a column count describe the whole layout. Zoom is therefore just a column count, which is
// what lets a zoom change be undone and redone without losing the scroll position.
const MIN_TILE_SIZE = 40;
const MAX_TILE_SIZE = 300;

// Rows rendered outside the viewport.
const OVERSCAN_PIXELS = 400;

// Leaves room below the last row for the floating buttons.
const PADDING_END = 100;

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// A pinch scales the rows without reflowing them, which puts more of the grid on screen than the
// viewport would normally hold. This describes how much, so enough rows and columns get rendered
// to fill it instead of leaving empty space around the edges.
export interface GridGesture {
    // How much further the grid now reaches on screen: the inverse of the scale being applied.
    spread: number;
    // Where the gesture is anchored, relative to the top left of the scroll container.
    centroidX: number;
    centroidY: number;
}

export interface GridLayout {
    containerWidth: number;
    containerHeight: number;
    scrollTop: number;
    columns: number;
    minColumns: number;
    maxColumns: number;
    tileSize: number;
    rowCount: number;
    contentHeight: number;
    // Rows to render, including overscan.
    firstRenderedRow: number;
    lastRenderedRow: number;
    // Tiles to render either side of a row's own columns, to fill the space a pinch exposes.
    extraTilesLeft: number;
    extraTilesRight: number;
    // Rows actually on screen, for the date overlay.
    firstVisibleRow: number;
    lastVisibleRow: number;
    setColumns: (columns: number) => void;
    scrollTo: (offset: number) => void;
}

// Screens that would show a huge number of tiles at the standard size start one step larger,
// so a big library doesn't open as a mosaic of specks.
const defaultColumns = (width: number, height: number) => {
    const standardColumns = Math.max(1, Math.floor(width / 70));
    const rows = Math.ceil(height / (width / standardColumns));
    return standardColumns * rows > 300 ? Math.max(1, Math.floor(width / 110)) : standardColumns;
};

// Windowing a uniform grid is plain arithmetic, so it's done here rather than with a
// virtualiser: row offsets and the total height then always match the current tile size
// within the same render, which is what zoom anchoring and the pinch gesture rely on.
//
export const useGridLayout = (
    scrollContainerRef: RefObject<HTMLDivElement>,
    itemCount: number,
    gesture: GridGesture | null
): GridLayout => {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [scrollTop, setScrollTop] = useState(0);
    const [preferredColumns, setPreferredColumns] = useGridColumns();

    useLayoutEffect(() => {
        const element = scrollContainerRef.current!;

        const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, [scrollContainerRef]);

    useLayoutEffect(() => {
        const element = scrollContainerRef.current!;

        const handleScroll = () => setScrollTop(element.scrollTop);
        element.addEventListener('scroll', handleScroll, { passive: true });
        return () => element.removeEventListener('scroll', handleScroll);
    }, [scrollContainerRef]);

    const { width, height } = size;
    const minColumns = Math.max(1, Math.floor(width / MAX_TILE_SIZE));
    const maxColumns = Math.max(minColumns, Math.floor(width / MIN_TILE_SIZE));
    const columns = clamp(preferredColumns ?? defaultColumns(width, height), minColumns, maxColumns);
    const tileSize = width === 0 ? 0 : width / columns;
    const rowCount = Math.ceil(itemCount / columns);

    const lastRow = rowCount - 1;
    const overscanRows = tileSize === 0 ? 0 : Math.ceil(OVERSCAN_PIXELS / tileSize);
    const firstVisibleRow = tileSize === 0 ? 0 : clamp(Math.floor(scrollTop / tileSize), 0, lastRow);
    const lastVisibleRow = tileSize === 0 ? -1 : clamp(Math.floor((scrollTop + height) / tileSize), 0, lastRow);

    // The part of the grid on screen, in layout coordinates. A gesture scales about its centroid,
    // which is the one point that doesn't move, so the view grows away from there in proportion
    // to the spread. Off-centre gestures therefore grow further one way than the other.
    const spread = gesture === null ? 1 : gesture.spread;
    const viewTop = gesture === null ? scrollTop : scrollTop + gesture.centroidY * (1 - spread);
    const viewLeft = gesture === null ? 0 : gesture.centroidX * (1 - spread);
    const viewBottom = viewTop + height * spread;
    const viewRight = viewLeft + width * spread;

    const setColumns = useCallback((value: number) => {
        setPreferredColumns(clamp(Math.round(value), minColumns, maxColumns));
    }, [setPreferredColumns, minColumns, maxColumns]);

    const scrollTo = useCallback((offset: number) => {
        const element = scrollContainerRef.current!;
        element.scrollTop = offset;
        // Read back, so the state matches whatever the browser clamped the offset to.
        setScrollTop(element.scrollTop);
    }, [scrollContainerRef]);

    return {
        containerWidth: width,
        containerHeight: height,
        scrollTop,
        columns,
        minColumns,
        maxColumns,
        tileSize,
        rowCount,
        contentHeight: rowCount * tileSize + PADDING_END,
        firstRenderedRow: tileSize === 0 ? 0 : Math.max(0, Math.floor(viewTop / tileSize) - overscanRows),
        lastRenderedRow: tileSize === 0 ? -1 : Math.min(lastRow, Math.floor(viewBottom / tileSize) + overscanRows),
        extraTilesLeft: tileSize === 0 ? 0 : Math.max(0, Math.ceil(-viewLeft / tileSize)),
        extraTilesRight: tileSize === 0 ? 0 : Math.max(0, Math.ceil((viewRight - width) / tileSize)),
        firstVisibleRow,
        lastVisibleRow,
        setColumns,
        scrollTo
    };
};
