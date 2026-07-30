import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { usePinch } from '@use-gesture/react';
import { GridGesture, GridLayout, clamp } from './use.grid.layout';
import { anchorScrollTop } from './use.grid.anchor';

// How long the reflow transition runs after the fingers lift: the old arrangement's dissolve,
// the pinched tile's glide into its new slot, and the ease-back when no reflow was needed.
const RELEASE_MS = 250;

// Pan movement below this many pixels doesn't re-run the layout; the slack the layout keeps
// around the rendered tiles covers the difference.
const PAN_QUANTUM = 100;

// The tile the gesture is centred on: an item, plus how far down its own tile the fingers sit.
// A fraction, so the same point can be located again in any column count.
interface PinchAnchor {
    itemIndex: number;
    fractionY: number;
}

interface Ghost {
    element: HTMLCanvasElement;
    removeTimer: number | null;
}

interface Options {
    scrollContainerRef: RefObject<HTMLDivElement>;
    // The layer holding the rows, which is scaled during the gesture.
    contentRef: RefObject<HTMLDivElement>;
    layout: GridLayout;
    itemCount: number;
    setGesture: (gesture: GridGesture | null) => void;
    enabled: boolean;
}

// A pinch scales the rows as one surface and reflows nothing, so the grid never rearranges
// itself under the fingers; moving both fingers together pans at the same time. Letting go
// reflows once, to the nearest odd column count, positioned so the pinched tile's new slot sits
// at the pinch point — the tile holds still while the old arrangement dissolves into the new
// one around it.
export const useGridPinch = ({ scrollContainerRef, contentRef, layout, itemCount, setGesture, enabled }: Options) => {
    const activeRef = useRef(false);
    const startTileSizeRef = useRef(0);
    // The tile size the gesture is currently asking for, which is what the scale shows.
    const desiredTileSizeRef = useRef(0);
    const anchorRef = useRef<PinchAnchor | null>(null);
    // Content x the fingers started over — the fixed point of the horizontal scaling.
    const originXRef = useRef(0);
    // Where the fingers are now, relative to the scroll container.
    const centroidRef = useRef({ x: 0, y: 0 });
    const startClientRef = useRef({ x: 0, y: 0 });
    const startOffsetYRef = useRef(0);
    const scrollStartRef = useRef(0);
    // Horizontal offset, carried over when a new pinch takes over mid-transition so nothing jumps.
    const translateBaseRef = useRef(0);
    const panRef = useRef({ dx: 0, dy: 0 });
    // True from gesture start until the transform is cleared, including the ease after release.
    const transformLiveRef = useRef(false);
    const lastGestureRef = useRef<GridGesture | null>(null);
    const ghostRef = useRef<Ghost | null>(null);
    const commitPendingRef = useRef(false);
    const cancelSettleRef = useRef<(() => void) | null>(null);

    // The photo preview zooms with the browser's own page zoom, so multi-touch is left alone
    // whenever the page is already zoomed — otherwise there'd be no way to zoom back out.
    const canPinch = () =>
        enabled &&
        layout.tileSize > 0 &&
        itemCount > 0 &&
        !(window.visualViewport && window.visualViewport.scale > 1);

    // Lets the native listeners below stay bound for the lifetime of the grid.
    const canPinchRef = useRef(canPinch);
    canPinchRef.current = canPinch;

    // Where the anchored point sits in a given column count, in content coordinates.
    const anchorPointY = (columns: number, tileSize: number) => {
        const { itemIndex, fractionY } = anchorRef.current!;
        return (Math.floor(itemIndex / columns) + fractionY) * tileSize;
    };

    const applyTransforms = () => {
        // Position the tile layer so the anchored point sits exactly under the fingers. The
        // vertical hold comes from the scroll position, so no translateY is needed here.
        const anchorY = anchorPointY(layout.columns, layout.tileSize);
        const scale = desiredTileSizeRef.current / layout.tileSize;
        const content = contentRef.current!;
        content.style.transformOrigin = `${originXRef.current}px ${anchorY}px`;
        content.style.transform = `translate(${translateBaseRef.current + panRef.current.dx}px, 0px) scale(${scale})`;

        // Tell the layout what the transform exposes, but only when it meaningfully changes — the
        // slack it keeps around the rendered tiles covers the quantised remainder.
        const spread = Math.max(1, Math.ceil(4 / scale) / 4);
        const translateX = Math.round((translateBaseRef.current + panRef.current.dx) / PAN_QUANTUM) * PAN_QUANTUM;
        const originY = anchorY;
        const last = lastGestureRef.current;

        if (spread === 1 && translateX === 0) {
            if (last !== null) {
                lastGestureRef.current = null;
                setGesture(null);
            }
        } else if (last === null || last.spread !== spread || last.translateX !== translateX
            || last.originX !== originXRef.current || last.originY !== originY) {
            const gesture = { spread, originX: originXRef.current, originY, translateX };
            lastGestureRef.current = gesture;
            setGesture(gesture);
        }
    };

    const removeGhost = () => {
        const ghost = ghostRef.current;
        if (ghost === null) return;
        if (ghost.removeTimer !== null) clearTimeout(ghost.removeTimer);
        ghost.element.remove();
        ghostRef.current = null;
    };

    const clearScale = () => {
        const content = contentRef.current!;
        content.style.transform = '';
        content.style.transformOrigin = '';
        content.style.willChange = '';

        translateBaseRef.current = 0;
        panRef.current = { dx: 0, dy: 0 };
        transformLiveRef.current = false;
        lastGestureRef.current = null;
        setGesture(null);
    };

    // A frame-by-frame animation that still lands on its end state if animation frames are being
    // starved — the timeout runs whatever the frames didn't get to.
    const animate = (step: (eased: number) => void, finish: () => void, registerCancel: (cancel: () => void) => void) => {
        const startTime = performance.now();
        let frame: number | null = null;
        let done = false;

        const complete = () => {
            if (done) return;
            done = true;
            if (frame !== null) cancelAnimationFrame(frame);
            clearTimeout(timeout);
            step(1);
            finish();
        };

        const tick = () => {
            const eased = 1 - (1 - Math.min(1, (performance.now() - startTime) / RELEASE_MS)) ** 3;
            if (eased >= 1) {
                complete();
                return;
            }
            step(eased);
            frame = requestAnimationFrame(tick);
        };

        const timeout = setTimeout(complete, RELEASE_MS + 200);
        registerCancel(() => {
            done = true;
            if (frame !== null) cancelAnimationFrame(frame);
            clearTimeout(timeout);
        });
        frame = requestAnimationFrame(tick);
    };

    // Release with no column change: ease the leftover scale and pan back to rest.
    const settleBack = () => {
        const { tileSize } = layout;
        const fromTileSize = desiredTileSizeRef.current;
        const fromTranslateX = translateBaseRef.current + panRef.current.dx;
        panRef.current = { ...panRef.current, dx: 0 };

        animate(
            (eased) => {
                desiredTileSizeRef.current = fromTileSize + (tileSize - fromTileSize) * eased;
                translateBaseRef.current = fromTranslateX * (1 - eased);
                applyTransforms();
            },
            () => {
                cancelSettleRef.current = null;
                clearScale();
            },
            (cancel) => { cancelSettleRef.current = cancel; }
        );
    };

    // Paints the visible tiles into a bitmap. A bitmap shows on the very first frame, unlike a
    // DOM clone, whose fresh image elements iOS repaints as dark placeholders while it decodes
    // their sources again — which read as the whole grid flashing black on release.
    const snapshotViewport = () => {
        const bounds = scrollContainerRef.current!.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bounds.width * ratio);
        canvas.height = Math.round(bounds.height * ratio);
        const context = canvas.getContext('2d');
        if (context === null) return null;
        context.scale(ratio, ratio);

        for (const tile of contentRef.current!.children) {
            const rect = tile.getBoundingClientRect();
            if (rect.right < bounds.left || rect.left > bounds.right ||
                rect.bottom < bounds.top || rect.top > bounds.bottom) continue;

            const x = rect.left - bounds.left;
            const y = rect.top - bounds.top;
            context.fillStyle = (tile.firstElementChild as HTMLElement).style.backgroundColor;
            context.fillRect(x, y, rect.width, rect.height);

            for (const image of tile.querySelectorAll('img')) {
                if (!image.complete || image.naturalWidth === 0 || !image.getAttribute('src')) continue;
                // The tiles crop with object-fit cover; drawing the same centred square keeps
                // the snapshot pixel-identical to what was on screen.
                const side = Math.min(image.naturalWidth, image.naturalHeight);
                context.drawImage(
                    image,
                    (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side,
                    x, y, rect.width, rect.height
                );
            }
        }
        return canvas;
    };

    // Release with a reflow: keep a snapshot of the old arrangement on screen to dissolve out
    // of, and commit the new column count immediately.
    const commitRelease = (targetColumns: number) => {
        const canvas = snapshotViewport();
        if (canvas !== null) {
            ghostRef.current = { element: canvas, removeTimer: null };
        }

        commitPendingRef.current = true;
        const anchor = {
            itemIndex: anchorRef.current!.itemIndex,
            rowFraction: anchorRef.current!.fractionY,
            // The pinched tile's slot goes where the fingers finished, not where they started.
            offsetY: centroidRef.current.y
        };
        layout.setColumns(targetColumns, (tileSize, columns) => anchorScrollTop(anchor, tileSize, columns));
    };

    // Runs once the reflow is in the DOM and the anchor hook has scrolled the pinched tile's new
    // slot into place — so it must be used after useGridAnchor.
    useLayoutEffect(() => {
        if (!commitPendingRef.current) return;
        commitPendingRef.current = false;

        // The snapshot covers the viewport exactly where it was, then dissolves into the new
        // arrangement — whose copy of the pinched tile sits at the same spot, so the tile itself
        // reads as never moving.
        const ghost = ghostRef.current;
        if (ghost !== null) {
            const scroller = scrollContainerRef.current!;
            const element = ghost.element;
            element.style.position = 'absolute';
            element.style.left = '0';
            element.style.top = `${scroller.scrollTop}px`;
            element.style.width = `${scroller.clientWidth}px`;
            element.style.height = `${scroller.clientHeight}px`;
            element.style.pointerEvents = 'none';
            contentRef.current!.parentElement!.appendChild(element);

            // Flush the starting opacity so the transition has something to animate from.
            void element.offsetHeight;
            element.style.transition = `opacity ${RELEASE_MS}ms linear`;
            element.style.opacity = '0';
            ghost.removeTimer = window.setTimeout(removeGhost, RELEASE_MS + 80);
        }

        // The new arrangement itself renders in place, untransformed.
        clearScale();
    });

    const begin = (origin: [number, number]) => {
        const takingOver = transformLiveRef.current;
        cancelSettleRef.current?.();
        cancelSettleRef.current = null;
        removeGhost();

        const element = scrollContainerRef.current!;
        const bounds = element.getBoundingClientRect();
        const centroidX = origin[0] - bounds.left;
        const centroidY = origin[1] - bounds.top;
        const scrollTop = element.scrollTop;

        // The content point under the fingers. While a previous gesture's transform is still
        // showing, the screen position has to be mapped back through it.
        let contentX = centroidX;
        let contentY = scrollTop + centroidY;
        if (takingOver) {
            const scale = desiredTileSizeRef.current / layout.tileSize;
            const anchorY = anchorPointY(layout.columns, layout.tileSize);
            const translateX = translateBaseRef.current + panRef.current.dx;
            const translateY = centroidRef.current.y + scrollTop - anchorY;
            contentX = originXRef.current + (centroidX - originXRef.current - translateX) / scale;
            contentY = anchorY + (centroidY + scrollTop - anchorY - translateY) / scale;
            // Carry on from the size currently showing, so nothing snaps backwards.
            startTileSizeRef.current = desiredTileSizeRef.current;
        } else {
            startTileSizeRef.current = layout.tileSize;
            desiredTileSizeRef.current = layout.tileSize;
        }

        const { columns, tileSize, rowCount } = layout;
        const row = clamp(Math.floor(contentY / tileSize), 0, rowCount - 1);
        const column = clamp(Math.floor(contentX / tileSize), 0, columns - 1);
        anchorRef.current = {
            itemIndex: Math.min(itemCount - 1, row * columns + column),
            fractionY: contentY / tileSize - row
        };

        originXRef.current = contentX;
        centroidRef.current = { x: centroidX, y: centroidY };
        startClientRef.current = { x: origin[0], y: origin[1] };
        startOffsetYRef.current = centroidY;
        translateBaseRef.current = centroidX - contentX;
        panRef.current = { dx: 0, dy: 0 };

        // Anchor vertically through the scroll position, so the rows chosen for rendering always
        // match what is actually on screen.
        element.scrollTop = anchorPointY(columns, tileSize) - centroidY;
        scrollStartRef.current = element.scrollTop;

        contentRef.current!.style.willChange = 'transform';
        transformLiveRef.current = true;
        activeRef.current = true;
        applyTransforms();
    };

    usePinch(
        ({ first, last, movement, origin, event }) => {
            if (first) {
                activeRef.current = false;
                // A commit is a frame away from landing — starting a gesture against the old
                // layout would anchor to the wrong tiles, so sit this one out.
                if (!canPinch() || commitPendingRef.current) return;
                begin(origin);
            }
            if (!activeRef.current) return;
            if (event.cancelable) event.preventDefault();

            const { containerWidth, minColumns, maxColumns } = layout;

            desiredTileSizeRef.current = clamp(
                startTileSizeRef.current * movement[0],
                containerWidth / maxColumns,
                containerWidth / minColumns
            );

            // Two-finger drift pans while the pinch zooms: vertically through the scroll position,
            // horizontally through the transform.
            panRef.current = {
                dx: origin[0] - startClientRef.current.x,
                dy: origin[1] - startClientRef.current.y
            };
            centroidRef.current = {
                x: startClientRef.current.x + panRef.current.dx,
                y: startOffsetYRef.current + panRef.current.dy
            };
            scrollContainerRef.current!.scrollTop = scrollStartRef.current - panRef.current.dy;

            if (last) {
                activeRef.current = false;
                const targetColumns = layout.snapColumns(containerWidth / desiredTileSizeRef.current);
                if (targetColumns === layout.columns) {
                    settleBack();
                } else {
                    commitRelease(targetColumns);
                }
                return;
            }

            applyTransforms();
        },
        {
            target: scrollContainerRef,
            eventOptions: { passive: false },
            pointer: { touch: true },
            from: () => [1, 0],
            enabled
        }
    );

    // iOS decides at the start of a gesture whether it will pan or zoom the page. The
    // container's `touch-action: pan-y` rules out the page zoom, and claiming multi-touch
    // here rules out the pan; the gesture events are Safari's own zoom, blocked for the
    // same reason. All of it is scoped to the grid, so the rest of the page still zooms.
    useEffect(() => {
        const element = scrollContainerRef.current!;

        const claimMultiTouch = (event: TouchEvent) => {
            if (event.touches.length > 1 && event.cancelable && canPinchRef.current()) {
                event.preventDefault();
            }
        };

        const blockPageZoom = (event: Event) => {
            if (event.cancelable && canPinchRef.current()) {
                event.preventDefault();
            }
        };

        element.addEventListener('touchstart', claimMultiTouch, { passive: false });
        element.addEventListener('gesturestart', blockPageZoom, { passive: false });
        element.addEventListener('gesturechange', blockPageZoom, { passive: false });

        return () => {
            element.removeEventListener('touchstart', claimMultiTouch);
            element.removeEventListener('gesturestart', blockPageZoom);
            element.removeEventListener('gesturechange', blockPageZoom);
        };
    }, [scrollContainerRef]);

    // Cancelling on unmount skips any pending commit deliberately — committing would set state on
    // an unmounted grid, and the preference only matters once a grid is showing again.
    useEffect(() => () => {
        cancelSettleRef.current?.();
        removeGhost();
    }, []);
};
