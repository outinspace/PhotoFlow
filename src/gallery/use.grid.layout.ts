import { RefObject, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useGridColumns } from '../hooks/use.settings';
import { reportGridScroll } from '../common/tile.loader';

// Tiles are square and together fill the container width exactly, so the container size and
// a column count describe the whole layout. Zoom is therefore just a column count, which is
// what lets a zoom change be undone and redone without losing the scroll position.
const MIN_TILE_SIZE = 40;
const MAX_TILE_SIZE = 300;

// Rows rendered outside the viewport.
const OVERSCAN_PIXELS = 400;

// Extra margin around the area a gesture exposes, covering its quantised pan updates and the
// frame of lag before the scroll state catches up.
const PAN_SLACK = 150;

// Leaves room below the last row for the floating buttons.
const PADDING_END = 100;

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// A pinch scales the rows without reflowing them, which changes which part of the grid is on
// screen. These are the transform's own parameters, so the layout can work out exactly what the
// scaled surface exposes and render it instead of leaving empty space.
export interface GridGesture {
    // How much further the grid can reach on screen: at least the inverse of the scale.
    spread: number;
    // The transform origin, in content coordinates.
    originX: number;
    originY: number;
    // The horizontal pan applied alongside the scale. Vertical panning moves the scroll instead.
    translateX: number;
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
    // The nearest allowed column count: odd, and within bounds.
    snapColumns: (value: number) => number;
    // Changes the column count, with the scroll position for the new layout supplied in the
    // same update. Without that, the first render of the new layout would use the old scroll
    // offset — a different part of the list entirely — and React would tear down every tile
    // just to rebuild the right ones a frame later, flashing placeholders on iOS.
    setColumns: (columns: number, scrollTopAt?: (tileSize: number, columns: number) => number) => void;
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
export const useGridLayout = (
    scrollContainerRef: RefObject<HTMLDivElement>,
    itemCount: number,
    gesture: GridGesture | null
): GridLayout => {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [scrollTop, setScrollTop] = useState(0);
    const [preferredColumns, setPreferredColumns] = useGridColumns();
    // A scroll offset decided alongside a column change, waiting to be applied to the element.
    const pendingScrollRef = useRef<number | null>(null);

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

        // Thumbnails are held back while the grid is moving too fast to look at, so
        // the velocity is measured here — this is the only scroll handler there is,
        // and a second listener on the same element would only cost more.
        let lastTop = element.scrollTop;
        let lastAt = performance.now();

        const handleScroll = () => {
            const top = element.scrollTop;
            const at = performance.now();

            reportGridScroll(Math.abs(top - lastTop) / Math.max(1, at - lastAt));
            lastTop = top;
            lastAt = at;

            setScrollTop(top);
        };

        element.addEventListener('scroll', handleScroll, { passive: true });
        return () => element.removeEventListener('scroll', handleScroll);
    }, [scrollContainerRef]);

    const { width, height } = size;

    // Column counts stick to odd numbers, so there is always a single tile at the centre of the
    // view — easier to keep track of while zooming.
    const rawMin = Math.max(1, Math.floor(width / MAX_TILE_SIZE));
    const rawMax = Math.max(rawMin, Math.floor(width / MIN_TILE_SIZE));
    const minColumns = rawMin % 2 === 1 ? rawMin : Math.min(rawMin + 1, rawMax);
    const maxColumns = rawMax % 2 === 1 ? rawMax : Math.max(rawMax - 1, minColumns);

    const snapColumns = useCallback((value: number) => {
        return clamp(2 * Math.round((value - 1) / 2) + 1, minColumns, maxColumns);
    }, [minColumns, maxColumns]);

    const columns = snapColumns(preferredColumns ?? defaultColumns(width, height));
    const tileSize = width === 0 ? 0 : width / columns;
    const rowCount = Math.ceil(itemCount / columns);

    const lastRow = rowCount - 1;
    const overscanRows = tileSize === 0 ? 0 : Math.ceil(OVERSCAN_PIXELS / tileSize);
    const firstVisibleRow = tileSize === 0 ? 0 : clamp(Math.floor(scrollTop / tileSize), 0, lastRow);
    const lastVisibleRow = tileSize === 0 ? -1 : clamp(Math.floor((scrollTop + height) / tileSize), 0, lastRow);

    // The part of the grid on screen, in layout coordinates. A gesture's transform holds its
    // origin still, so the view spreads away from that point — further one way than the other
    // when the gesture is off-centre — and any horizontal pan shifts it sideways on top.
    let viewTop = scrollTop;
    let viewBottom = scrollTop + height;
    let viewLeft = 0;
    let viewRight = width;
    if (gesture !== null) {
        const { spread, originX, originY, translateX } = gesture;
        viewTop = originY + (scrollTop - originY) * spread - PAN_SLACK;
        viewBottom = originY + (scrollTop + height - originY) * spread + PAN_SLACK;
        viewLeft = originX - (originX + translateX) * spread - PAN_SLACK;
        viewRight = originX + (width - originX - translateX) * spread + PAN_SLACK;
    }

    const setColumns = useCallback((value: number, scrollTopAt?: (tileSize: number, columns: number) => number) => {
        const columns = snapColumns(value);
        setPreferredColumns(columns);

        if (scrollTopAt !== undefined) {
            const target = scrollTopAt(width / columns, columns);
            pendingScrollRef.current = target;
            // The state leads the element by one effect, so the very first render of the new
            // layout already windows the right rows. The element catches up below, before paint.
            setScrollTop(Math.max(0, target));
        }
    }, [setPreferredColumns, snapColumns, width]);

    useLayoutEffect(() => {
        if (pendingScrollRef.current === null) return;
        const element = scrollContainerRef.current!;
        element.scrollTop = pendingScrollRef.current;
        pendingScrollRef.current = null;
        // Read back, so the state matches whatever the browser clamped the offset to.
        setScrollTop(element.scrollTop);
    });

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
        snapColumns,
        setColumns,
        scrollTo
    };
};
