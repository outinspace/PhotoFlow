import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { usePinch } from '@use-gesture/react';
import { GridGesture, GridLayout, clamp } from './use.grid.layout';
import { GridAnchor } from './use.grid.anchor';

// How long the released grid takes to glide from wherever the fingers left it onto the snapped
// column count, before the reflow swaps the real layout in.
const SETTLE_MS = 250;

// Pan movement below this many pixels doesn't re-run the layout; the slack the layout keeps
// around the rendered tiles covers the difference.
const PAN_QUANTUM = 100;

// The tile the gesture is centred on, as an item plus where in that tile the fingers sit. Kept as
// fractions so the same point can be located again in any column count.
interface PinchAnchor {
    itemIndex: number;
    fractionX: number;
    fractionY: number;
}

interface Ghost {
    element: HTMLDivElement;
    columns: number;
    tileSize: number;
    removeTimer: number | null;
}

interface Options {
    scrollContainerRef: RefObject<HTMLDivElement>;
    // The layer holding the rows, which is scaled during the gesture.
    contentRef: RefObject<HTMLDivElement>;
    layout: GridLayout;
    itemCount: number;
    // Must be the same function the grid uses for its zoom buttons: it owns putting the
    // anchored item back once the new column count is in the DOM.
    reanchor: (anchor: GridAnchor) => void;
    setGesture: (gesture: GridGesture | null) => void;
    // Prototype: reflow at every column step during the gesture, dissolving from the old
    // arrangement into the new one, rather than holding one layout until the fingers lift.
    // Zero keeps the hold-until-release behaviour; otherwise it's the dissolve length in ms.
    liveReflowFadeMs: number;
    enabled: boolean;
}

// A pinch scales the rows as one surface, and moving both fingers together pans at the same time:
// vertically through the scroll position, horizontally through the transform. Letting go glides
// smoothly onto the nearest allowed column count. Whether the reflow happens continuously during
// the gesture or once at the end is the one thing liveReflowFadeMs changes.
export const useGridPinch = ({ scrollContainerRef, contentRef, layout, itemCount, reanchor, setGesture, liveReflowFadeMs, enabled }: Options) => {
    const liveReflow = liveReflowFadeMs > 0;

    const activeRef = useRef(false);
    const startTileSizeRef = useRef(0);
    // The tile size the gesture is currently asking for, which is what the scale shows.
    const desiredTileSizeRef = useRef(0);
    const anchorRef = useRef<PinchAnchor | null>(null);
    // Content x the fingers started over. Horizontal scaling stays centred here, so the grid
    // never slides sideways when the anchor item lands in a different column.
    const originXRef = useRef(0);
    // Where the fingers are now, relative to the scroll container.
    const centroidRef = useRef({ x: 0, y: 0 });
    const startClientRef = useRef({ x: 0, y: 0 });
    const startOffsetYRef = useRef(0);
    const scrollStartRef = useRef(0);
    // Horizontal offset, carried over when a new pinch takes over mid-glide so nothing jumps.
    const translateBaseRef = useRef(0);
    const panRef = useRef({ dx: 0, dy: 0 });
    // True from gesture start until the transform is cleared, including the glide after release.
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

    // Where the anchor tile's chosen point sits in a given column count, in content coordinates.
    const anchorPointY = (columns: number, tileSize: number) => {
        const { itemIndex, fractionY } = anchorRef.current!;
        return (Math.floor(itemIndex / columns) + fractionY) * tileSize;
    };

    // Positions one layer — the live rows, or a fading ghost of an older arrangement — so its
    // copy of the anchor point sits exactly under the fingers.
    const applyLayer = (element: HTMLElement, columns: number, tileSize: number) => {
        const anchorY = anchorPointY(columns, tileSize);
        const scale = desiredTileSizeRef.current / tileSize;
        const scrollTop = scrollContainerRef.current!.scrollTop;

        const translateX = translateBaseRef.current + panRef.current.dx;
        // Zero for the live layer, whose scroll position is already anchored; a ghost uses it to
        // stay put while the scroll moves out from under it.
        const translateY = centroidRef.current.y + scrollTop - anchorY;

        element.style.transformOrigin = `${originXRef.current}px ${anchorY}px`;
        element.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    };

    const applyTransforms = () => {
        applyLayer(contentRef.current!, layout.columns, layout.tileSize);

        const ghost = ghostRef.current;
        if (ghost !== null) {
            applyLayer(ghost.element, ghost.columns, ghost.tileSize);
        }

        // Tell the layout what the transform exposes, but only when it meaningfully changes — the
        // slack it keeps around the rendered tiles covers the quantised remainder.
        const scale = desiredTileSizeRef.current / layout.tileSize;
        const spread = Math.max(1, Math.ceil(4 / scale) / 4);
        const translateX = Math.round((translateBaseRef.current + panRef.current.dx) / PAN_QUANTUM) * PAN_QUANTUM;
        const originY = anchorPointY(layout.columns, layout.tileSize);
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

    // Snapshots the arrangement about to be replaced. Cloning keeps the outgoing tiles' own image
    // elements, so the dissolve never waits on a decode; the incoming layer is what React renders.
    const spawnGhost = () => {
        removeGhost();

        const source = contentRef.current!;
        const element = source.cloneNode(true) as HTMLDivElement;
        element.style.pointerEvents = 'none';
        element.style.opacity = '1';
        source.parentElement!.appendChild(element);

        ghostRef.current = { element, columns: layout.columns, tileSize: layout.tileSize, removeTimer: null };
    };

    const startGhostFade = () => {
        const ghost = ghostRef.current;
        if (ghost === null || ghost.removeTimer !== null) return;

        // Flush the starting opacity so the transition has something to animate from.
        void ghost.element.offsetHeight;
        ghost.element.style.transition = `opacity ${liveReflowFadeMs}ms linear`;
        ghost.element.style.opacity = '0';
        ghost.removeTimer = window.setTimeout(removeGhost, liveReflowFadeMs + 80);
    };

    const clearScale = () => {
        const content = contentRef.current!;
        content.style.transform = '';
        content.style.transformOrigin = '';
        content.style.willChange = '';

        removeGhost();
        translateBaseRef.current = 0;
        panRef.current = { dx: 0, dy: 0 };
        transformLiveRef.current = false;
        lastGestureRef.current = null;
        setGesture(null);
    };

    // Reflows to a new column count, holding the anchor tile where it is. The anchor hook does the
    // scrolling; the layout effect below re-places the transforms once the new rows are in the DOM.
    const commitColumns = (targetColumns: number) => {
        const { itemIndex, fractionY } = anchorRef.current!;
        commitPendingRef.current = true;
        reanchor({ itemIndex, rowFraction: fractionY, offsetY: centroidRef.current.y });
        layout.setColumns(targetColumns);
    };

    // Glides the scale, and any horizontal pan, onto the snapped column count. The animation ends
    // at exactly the target tile size, so handing over to the real layout never changes size.
    const settle = (targetColumns: number) => {
        const { containerWidth, columns, tileSize } = layout;
        const fromTileSize = desiredTileSizeRef.current;
        const targetTileSize = containerWidth / targetColumns;
        const fromTranslateX = translateBaseRef.current + panRef.current.dx;

        // The glide ends still scaled — at the target tile size, but scaled about the pinch point,
        // which leaves the columns sitting off the container edges. This is the offset that
        // cancels that out, so the glide lands flush and the reflow only regroups the tiles
        // instead of also sliding them sideways.
        const toTranslateX = originXRef.current * (targetTileSize / tileSize - 1);
        panRef.current = { ...panRef.current, dx: 0 };
        const startTime = performance.now();
        let frame: number | null = null;
        let done = false;

        // Runs exactly once — when the animation finishes, or from the timeout below if animation
        // frames are being starved.
        const finish = () => {
            if (done) return;
            done = true;
            if (frame !== null) cancelAnimationFrame(frame);
            clearTimeout(timeout);
            cancelSettleRef.current = null;
            desiredTileSizeRef.current = targetTileSize;
            translateBaseRef.current = 0;

            if (targetColumns === columns) {
                clearScale();
                return;
            }

            commitColumns(targetColumns);
        };

        const step = () => {
            const eased = 1 - (1 - Math.min(1, (performance.now() - startTime) / SETTLE_MS)) ** 3;
            desiredTileSizeRef.current = fromTileSize + (targetTileSize - fromTileSize) * eased;
            translateBaseRef.current = fromTranslateX + (toTranslateX - fromTranslateX) * eased;
            applyTransforms();

            if (eased < 1) {
                frame = requestAnimationFrame(step);
            } else {
                finish();
            }
        };

        const timeout = setTimeout(finish, SETTLE_MS + 200);
        cancelSettleRef.current = () => {
            done = true;
            if (frame !== null) cancelAnimationFrame(frame);
            clearTimeout(timeout);
            cancelSettleRef.current = null;
        };
        frame = requestAnimationFrame(step);
    };

    const begin = (origin: [number, number]) => {
        const takingOver = transformLiveRef.current;
        cancelSettleRef.current?.();
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
            fractionX: contentX / tileSize - column,
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

            const targetColumns = layout.snapColumns(containerWidth / desiredTileSizeRef.current);

            if (last) {
                activeRef.current = false;
                settle(targetColumns);
                return;
            }

            if (liveReflow && targetColumns !== layout.columns) {
                // Keep the outgoing arrangement on screen to dissolve out of, then reflow.
                spawnGhost();
                commitColumns(targetColumns);
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

    // Runs after the anchor hook has put the anchored tile back, so it must be used after
    // useGridAnchor.
    useLayoutEffect(() => {
        if (!commitPendingRef.current) return;
        commitPendingRef.current = false;

        if (!activeRef.current && cancelSettleRef.current === null) {
            // The gesture is over and this was its final reflow.
            clearScale();
            return;
        }

        // The reflow moved the scroll position to hold the anchor tile, so panning has to measure
        // from there — otherwise the next frame would drag the grid back to where it started.
        scrollStartRef.current = scrollContainerRef.current!.scrollTop + panRef.current.dy;

        // Re-place both layers against the new column count, then dissolve the old one away.
        applyTransforms();
        startGhostFade();
    });

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
