import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { usePinch } from '@use-gesture/react';
import { GridGesture, GridLayout, clamp } from './use.grid.layout';
import { GridAnchor, computeAnchor } from './use.grid.anchor';

// How long the grid takes to glide off the size the gesture ended on and onto the snapped one.
const SETTLE_MS = 180;

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
// itself under the fingers. Letting go snaps to the nearest column count and reflows in one
// step, around whichever tile the gesture was centred on — anywhere on screen, edges included.
export const useGridPinch = ({ scrollContainerRef, contentRef, layout, itemCount, reanchor, setGesture, enabled }: Options) => {
    const activeRef = useRef(false);
    const startTileSizeRef = useRef(0);
    // The tile size the gesture is asking for, which is what the scale renders. Snapped to a
    // column count on release.
    const desiredTileSizeRef = useRef(0);
    const anchorRef = useRef<GridAnchor | null>(null);
    const centroidRef = useRef({ x: 0, y: 0 });
    const spreadRef = useRef(1);
    const commitPendingRef = useRef(false);
    const settleFrameRef = useRef<number | null>(null);

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

    // Scaling about the point the gesture is centred on holds that point still, however far
    // off-centre it is.
    const setOrigin = (scrollTop: number) => {
        const { x, y } = centroidRef.current;
        contentRef.current!.style.transformOrigin = `${x}px ${scrollTop + y}px`;
    };

    const applyScale = (committedTileSize: number) => {
        const scale = desiredTileSizeRef.current / committedTileSize;
        contentRef.current!.style.transform = `scale(${scale})`;

        // Scaled-down rows would leave the edges of the viewport empty, so the grid is told how
        // far it now reaches and fills the gap with the neighbouring tiles. Quantising keeps this
        // to a handful of renders per gesture, and it only ever adds tiles outside the viewport —
        // nothing already on screen moves.
        const spread = Math.max(1, Math.ceil(4 / scale) / 4);
        if (spread !== spreadRef.current) {
            spreadRef.current = spread;
            setGesture(spread === 1 ? null : { spread, centroidX: centroidRef.current.x, centroidY: centroidRef.current.y });
        }
    };

    const clearScale = () => {
        const content = contentRef.current!;
        content.style.transform = '';
        content.style.transformOrigin = '';
        content.style.willChange = '';

        spreadRef.current = 1;
        setGesture(null);
    };

    // Eases the leftover scale away, starting from the size the gesture ended on so the reflow
    // it follows is never a visible jump. Cosmetic only: the column count and scroll position
    // are already committed by the time this runs.
    const settle = (committedTileSize: number) => {
        const from = desiredTileSizeRef.current;
        const startTime = performance.now();

        const step = () => {
            const progress = Math.min(1, (performance.now() - startTime) / SETTLE_MS);
            desiredTileSizeRef.current = from + (committedTileSize - from) * (1 - (1 - progress) ** 3);
            applyScale(committedTileSize);

            if (progress < 1) {
                settleFrameRef.current = requestAnimationFrame(step);
                return;
            }

            settleFrameRef.current = null;
            clearScale();
        };

        applyScale(committedTileSize);
        settleFrameRef.current = requestAnimationFrame(step);
    };

    const begin = (origin: [number, number]) => {
        const interrupted = settleFrameRef.current !== null;
        if (interrupted) {
            cancelAnimationFrame(settleFrameRef.current!);
            settleFrameRef.current = null;
        }

        const element = scrollContainerRef.current!;
        const bounds = element.getBoundingClientRect();
        centroidRef.current = { x: origin[0] - bounds.left, y: origin[1] - bounds.top };

        // Taking over an interrupted settle where it left off avoids snapping backwards.
        startTileSizeRef.current = interrupted ? desiredTileSizeRef.current : layout.tileSize;
        desiredTileSizeRef.current = startTileSizeRef.current;

        // The same offset has to drive both, or the tile that gets restored isn't the one the
        // scale held still.
        const scrollTop = element.scrollTop;
        anchorRef.current = computeAnchor(layout, scrollTop, centroidRef.current.x, centroidRef.current.y, itemCount);

        // Fixed for the whole gesture, so drifting fingers never shift the grid.
        setOrigin(scrollTop);
        contentRef.current!.style.willChange = 'transform';

        activeRef.current = true;
    };

    usePinch(
        ({ first, last, movement, origin, event }) => {
            if (first) {
                activeRef.current = false;
                if (!canPinch()) return;
                begin(origin);
            }
            if (!activeRef.current) return;
            if (event.cancelable) event.preventDefault();

            const { containerWidth, minColumns, maxColumns, columns, tileSize } = layout;

            desiredTileSizeRef.current = clamp(
                startTileSizeRef.current * movement[0],
                containerWidth / maxColumns,
                containerWidth / minColumns
            );
            applyScale(tileSize);

            if (!last) return;
            activeRef.current = false;

            const targetColumns = clamp(Math.round(containerWidth / desiredTileSizeRef.current), minColumns, maxColumns);
            if (targetColumns === columns) {
                settle(tileSize);
                return;
            }

            // Reflow straight away — the settle below only smooths the leftover size change.
            commitPendingRef.current = true;
            reanchor(anchorRef.current!);
            layout.setColumns(targetColumns);
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

        // The scroll position moved with the reflow, so the origin has to follow it to keep
        // pointing at the same place on screen.
        setOrigin(scrollContainerRef.current!.scrollTop);
        settle(layout.tileSize);
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

    useEffect(() => () => {
        if (settleFrameRef.current !== null) {
            cancelAnimationFrame(settleFrameRef.current);
        }
    }, []);
};
