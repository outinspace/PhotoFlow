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
    enabled: boolean;
}

// Pinching scales the rows as one surface and reflows nothing, so the grid never rearranges
// itself under the fingers; moving both fingers together pans at the same time. Letting go
// glides smoothly onto the nearest allowed column count, then reflows in one step around
// whichever tile the gesture was centred on — anywhere on screen, edges included.
export const useGridPinch = ({ scrollContainerRef, contentRef, layout, itemCount, reanchor, setGesture, enabled }: Options) => {
    const activeRef = useRef(false);
    const startTileSizeRef = useRef(0);
    // The tile size the gesture is currently asking for, which is what the scale shows.
    const desiredTileSizeRef = useRef(0);
    // The transform origin, in content coordinates — the fixed point of the scale.
    const originRef = useRef({ x: 0, y: 0 });
    const startClientRef = useRef({ x: 0, y: 0 });
    const startOffsetYRef = useRef(0);
    const scrollStartRef = useRef(0);
    // Horizontal offset carried over when a new pinch takes over mid-glide, so nothing jumps.
    const translateBaseRef = useRef(0);
    const panRef = useRef({ dx: 0, dy: 0 });
    const anchorRef = useRef<GridAnchor | null>(null);
    // True from gesture start until the transform is cleared, including the glide after release.
    const transformLiveRef = useRef(false);
    const lastGestureRef = useRef<GridGesture | null>(null);
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

    const anchorFromContent = (contentX: number, contentY: number, offsetY: number): GridAnchor => {
        const { tileSize, columns, rowCount } = layout;
        const row = clamp(Math.floor(contentY / tileSize), 0, rowCount - 1);
        const column = clamp(Math.floor(contentX / tileSize), 0, columns - 1);
        return {
            itemIndex: Math.min(itemCount - 1, row * columns + column),
            rowFraction: contentY / tileSize - row,
            offsetY
        };
    };

    const applyScale = (committedTileSize: number) => {
        const scale = desiredTileSizeRef.current / committedTileSize;
        const translateX = translateBaseRef.current + panRef.current.dx;
        const content = contentRef.current!;
        content.style.transformOrigin = `${originRef.current.x}px ${originRef.current.y}px`;
        content.style.transform = `translate(${translateX}px, 0px) scale(${scale})`;

        // Tell the layout what the transform exposes, but only when it meaningfully changes —
        // the slack it keeps around the rendered tiles covers the quantised remainder.
        const spread = Math.max(1, Math.ceil(4 / scale) / 4);
        const quantisedX = Math.round(translateX / PAN_QUANTUM) * PAN_QUANTUM;
        const last = lastGestureRef.current;
        if (spread === 1 && quantisedX === 0) {
            if (last !== null) {
                lastGestureRef.current = null;
                setGesture(null);
            }
        } else if (last === null || last.spread !== spread || last.translateX !== quantisedX
            || last.originX !== originRef.current.x || last.originY !== originRef.current.y) {
            const gesture = { spread, originX: originRef.current.x, originY: originRef.current.y, translateX: quantisedX };
            lastGestureRef.current = gesture;
            setGesture(gesture);
        }
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

    // Glides the scale (and any horizontal pan) onto the snapped column count, then commits the
    // reflow. The animation ends at exactly the target tile size, so the handoff to the real
    // layout changes arrangement but never size.
    const settle = (targetColumns: number) => {
        const { containerWidth, columns, tileSize } = layout;
        const fromTileSize = desiredTileSizeRef.current;
        const targetTileSize = containerWidth / targetColumns;
        const fromTranslateX = translateBaseRef.current + panRef.current.dx;
        panRef.current = { ...panRef.current, dx: 0 };
        const startTime = performance.now();
        let frame: number | null = null;
        let done = false;

        // The reflow itself, run exactly once — by the animation finishing, or by the timeout
        // below if animation frames are being starved.
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

            // The transform is cleared in the layout effect below, once the anchor hook has put
            // the pinched tile back in the reflowed layout.
            commitPendingRef.current = true;
            reanchor(anchorRef.current!);
            layout.setColumns(targetColumns);
        };

        const step = () => {
            const eased = 1 - (1 - Math.min(1, (performance.now() - startTime) / SETTLE_MS)) ** 3;
            desiredTileSizeRef.current = fromTileSize + (targetTileSize - fromTileSize) * eased;
            translateBaseRef.current = fromTranslateX * (1 - eased);
            applyScale(tileSize);

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
            const translateX = translateBaseRef.current + panRef.current.dx;
            contentX = originRef.current.x + (centroidX - originRef.current.x - translateX) / scale;
            contentY = originRef.current.y + (scrollTop + centroidY - originRef.current.y) / scale;
            // Carry on from the size currently showing, so nothing snaps backwards.
            startTileSizeRef.current = desiredTileSizeRef.current;
        } else {
            startTileSizeRef.current = layout.tileSize;
            desiredTileSizeRef.current = layout.tileSize;
        }

        // Re-anchor the transform on the new centroid, with the translate and scroll chosen so
        // nothing on screen moves at the moment of takeover. (For a fresh gesture these leave
        // the translate at zero and the scroll where it is.)
        originRef.current = { x: contentX, y: contentY };
        translateBaseRef.current = centroidX - contentX;
        element.scrollTop = contentY - centroidY;
        scrollStartRef.current = element.scrollTop;

        startClientRef.current = { x: origin[0], y: origin[1] };
        startOffsetYRef.current = centroidY;
        panRef.current = { dx: 0, dy: 0 };
        anchorRef.current = anchorFromContent(contentX, contentY, centroidY);

        contentRef.current!.style.willChange = 'transform';
        transformLiveRef.current = true;
        activeRef.current = true;
        applyScale(layout.tileSize);
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

            const { containerWidth, minColumns, maxColumns, tileSize } = layout;

            desiredTileSizeRef.current = clamp(
                startTileSizeRef.current * movement[0],
                containerWidth / maxColumns,
                containerWidth / minColumns
            );

            // Two-finger drift pans while the pinch zooms: vertically through the scroll
            // position, horizontally through the transform.
            panRef.current = {
                dx: origin[0] - startClientRef.current.x,
                dy: origin[1] - startClientRef.current.y
            };
            scrollContainerRef.current!.scrollTop = scrollStartRef.current - panRef.current.dy;

            applyScale(tileSize);

            if (!last) return;
            activeRef.current = false;

            // The pinched tile should end up where the fingers finished, not where they started.
            anchorRef.current = { ...anchorRef.current!, offsetY: startOffsetYRef.current + panRef.current.dy };
            settle(layout.snapColumns(containerWidth / desiredTileSizeRef.current));
        },
        {
            target: scrollContainerRef,
            eventOptions: { passive: false },
            pointer: { touch: true },
            from: () => [1, 0],
            enabled
        }
    );

    // Runs after the anchor hook has put the pinched tile back, so it must be used after
    // useGridAnchor.
    useLayoutEffect(() => {
        if (!commitPendingRef.current) return;
        commitPendingRef.current = false;
        clearScale();
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

    // Cancelling on unmount skips any pending commit deliberately — committing would set state
    // on an unmounted grid, and the preference only matters once a grid is showing again.
    useEffect(() => () => cancelSettleRef.current?.(), []);
};
