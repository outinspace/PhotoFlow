import { useEffect, useLayoutEffect, useRef } from 'react';
import { Item } from '../types';
import { GridLayout, clamp } from './use.grid.layout';

// Scrolling is only ever restored by item, never by pixel offset: the column count, and so
// every row offset, differs between devices, zoom levels and orientations.
export interface GridAnchor {
    itemIndex: number;
    // How far into the anchor item's row the anchor point sits, as a fraction of a tile.
    rowFraction: number;
    // Where the anchor point sat, measured down from the top of the viewport.
    offsetY: number;
}

// The item at a point in the viewport, plus enough detail to put it back there afterwards.
// scrollTop is passed in rather than read off the layout because a gesture has to use the live
// value from the DOM: the layout's copy lags by up to a frame while the list is still moving.
export const computeAnchor = (layout: GridLayout, scrollTop: number, offsetX: number, offsetY: number, itemCount: number): GridAnchor => {
    const { tileSize, columns, rowCount } = layout;

    const contentY = scrollTop + offsetY;
    const row = clamp(Math.floor(contentY / tileSize), 0, rowCount - 1);
    const column = clamp(Math.floor(offsetX / tileSize), 0, columns - 1);

    return {
        itemIndex: Math.min(itemCount - 1, row * columns + column),
        rowFraction: contentY / tileSize - row,
        offsetY
    };
};

export const anchorScrollTop = (anchor: GridAnchor, tileSize: number, columns: number) =>
    (Math.floor(anchor.itemIndex / columns) + anchor.rowFraction) * tileSize - anchor.offsetY;

const ANCHOR_PARAM = 'anchorItemId';

// Writing the anchor to the URL is delayed until scrolling settles: Safari rate-limits
// history updates, and where the user pauses is the only position worth remembering.
const URL_WRITE_DELAY_MS = 300;

interface Options {
    items: Item[];
    layout: GridLayout;
    // Used as the anchor when a shared preview link is opened cold, so closing the preview
    // leaves the grid on that photo rather than back at the top.
    fallbackItemId: number | null;
    enableUrlPersistence: boolean;
}

export const useGridAnchor = ({ items, layout, fallbackItemId, enableUrlPersistence }: Options) => {
    const centreAnchorRef = useRef<GridAnchor | null>(null);
    const didRestoreRef = useRef(false);
    const appliedWidthRef = useRef(layout.containerWidth);

    // Scroll straight to the item the URL names, once the grid has been measured and the
    // items have loaded. Runs before the browser paints, so the grid doesn't flash at the top.
    useLayoutEffect(() => {
        if (didRestoreRef.current || !enableUrlPersistence) return;
        if (layout.tileSize === 0 || items.length === 0) return;

        didRestoreRef.current = true;

        const storedItemId = new URLSearchParams(window.location.search).get(ANCHOR_PARAM);
        const itemId = storedItemId === null ? fallbackItemId : parseInt(storedItemId, 10);
        if (itemId === null) return;

        // The stored item can be missing after a filter change or a deletion, in which case
        // the grid just opens at the top.
        const itemIndex = items.findIndex(item => item.itemId === itemId);
        if (itemIndex === -1) return;

        const row = Math.floor(itemIndex / layout.columns);
        layout.scrollTo((row + 0.5) * layout.tileSize - layout.containerHeight / 2);
    });

    // After a container resize (rotation, sidebar), put whatever was in the middle of the
    // viewport back there before the browser paints. Zoom changes don't come through here —
    // setColumns takes the corrected scroll position in the same update.
    useLayoutEffect(() => {
        if (appliedWidthRef.current === layout.containerWidth) return;
        appliedWidthRef.current = layout.containerWidth;

        const centre = centreAnchorRef.current;
        if (centre === null || layout.tileSize === 0) return;

        layout.scrollTo(anchorScrollTop({ ...centre, offsetY: layout.containerHeight / 2 }, layout.tileSize, layout.columns));
    });

    useEffect(() => {
        if (layout.tileSize === 0 || items.length === 0) return;

        const anchor = computeAnchor(layout, layout.scrollTop, layout.containerWidth / 2, layout.containerHeight / 2, items.length);
        centreAnchorRef.current = anchor;

        if (!enableUrlPersistence) return;

        const timer = setTimeout(() => {
            const url = new URL(window.location.href);
            url.searchParams.set(ANCHOR_PARAM, items[anchor.itemIndex].itemId.toString());
            window.history.replaceState({}, '', url.toString());
        }, URL_WRITE_DELAY_MS);

        return () => clearTimeout(timer);
    }, [
        items,
        enableUrlPersistence,
        layout.scrollTop,
        layout.tileSize,
        layout.columns,
        layout.containerWidth,
        layout.containerHeight
    ]);
};
