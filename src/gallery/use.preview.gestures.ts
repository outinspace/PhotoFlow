import { RefObject, useEffect, useRef, useState } from 'react';
import { useSpring } from '@react-spring/web';
import { useGesture } from '@use-gesture/react';
import { clamp } from './use.grid.layout';
import { Item } from '../types';

// Everything the preview surface does with a finger on it: swipe between photos, drag down to
// dismiss, pinch and double tap to zoom, drag to pan while zoomed.
//
// The zoom is the app's own rather than the browser's page zoom. Page zoom moves the visual
// viewport out from under a layout built entirely from viewport-sized panes offset by
// window.innerWidth — offsets that stay in layout pixels while what you see does not — so a
// swipe begun before a pinch would leave the neighbouring photo stranded across this one at the
// wrong size, with no gesture left that could put it back.

export const MAX_SCALE = 6;
// A double tap goes to whatever fills the screen, as Photos does. A photo already close to
// filling it still has to visibly do something, hence the floor.
const DOUBLE_TAP_MIN_SCALE = 2;
const DOUBLE_TAP_WINDOW_MS = 300;
// Two taps further apart than this are two taps in a row, not a double tap.
const DOUBLE_TAP_SLOP_PX = 40;
// Below this the photo counts as zoomed out, and the buttons over it come back.
const ZOOMED_EPSILON = 0.01;
// Which way a drag is going is decided once it has moved this far, and held for the rest of it.
const DIRECTION_THRESHOLD_PX = 10;

const SNAP = { tension: 300, clamp: true };

// The photo's own size within a viewport-sized object-fit: contain box. Dimensions the catalog
// doesn't have fall back to the box itself, which is the most a photo of unknown shape can be.
export const containedSize = (
    viewport: { width: number, height: number },
    pixels: { width: number | null, height: number | null }
) => {
    if (!pixels.width || !pixels.height) return viewport;
    const fit = Math.min(viewport.width / pixels.width, viewport.height / pixels.height);
    return { width: pixels.width * fit, height: pixels.height * fit };
};

// How far the photo may travel from centre before its own edge would come inside the viewport.
// Zero on an axis it doesn't fill, which is what keeps it centred there.
export const panLimit = (viewportSide: number, contentSide: number, scale: number) =>
    Math.max(0, (contentSide * scale - viewportSide) / 2);

// Scaling about the box centre such that the content point that was under `from` ends up under
// `to`: the fingers keep hold of the same part of the photo through a pinch, and carry it with
// them when they drift. Coordinates are relative to the centre of the box.
export const focalOffset = (offset: number, from: number, to: number, scale: number, nextScale: number) =>
    to - (nextScale / scale) * (from - offset);

interface Options {
    surfaceRef: RefObject<HTMLElement>;
    item: Item | undefined;
    itemIndex: number;
    // Video keeps the browser's own touch handling so its controls still work, so it doesn't zoom.
    canZoom: boolean;
    photoAnimationsEnabled: boolean;
    onMoveNext?: Function;
    onMovePrevious?: Function;
    onClose?: Function;
}

export const usePreviewGestures = ({
    surfaceRef, item, itemIndex, canZoom, photoAnimationsEnabled, onMoveNext, onMovePrevious, onClose
}: Options) => {
    const [carousel, carouselApi] = useSpring(() => ({ x: 0, y: 0, opacity: 1, scale: 1 }));
    const [zoom, zoomApi] = useSpring(() => ({ x: 0, y: 0, scale: 1 }));
    const [isZoomed, setIsZoomed] = useState(false);

    // The spring's own values can't be read mid-gesture without subscribing to every frame, so
    // the gesture keeps its own copy of where it has got to.
    const scaleRef = useRef(1);
    const offsetRef = useRef({ x: 0, y: 0 });
    const zoomedRef = useRef(false);
    const pinchingRef = useRef(false);
    const pinchOriginRef = useRef({ x: 0, y: 0 });
    const panStartRef = useRef({ x: 0, y: 0 });
    const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
    const directionRef = useRef<'vertical' | 'horizontal'>();
    // A ref rather than state: a second drag event can arrive before a re-render would have
    // told it an animation was running, which is exactly when it must not start another.
    const animatingRef = useRef(false);

    const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

    const photoSize = () => containedSize(viewport(), { width: item?.widthPixels ?? null, height: item?.heightPixels ?? null });

    const limits = (scale: number) => {
        const box = viewport();
        const photo = photoSize();
        return {
            x: panLimit(box.width, photo.width, scale),
            y: panLimit(box.height, photo.height, scale)
        };
    };

    const markZoomed = (scale: number) => {
        const next = scale > 1 + ZOOMED_EPSILON;
        if (next === zoomedRef.current) return;
        zoomedRef.current = next;
        setIsZoomed(next);
    };

    // Mid-gesture: show exactly what the fingers ask for, no spring in the way.
    const showZoom = (scale: number, x: number, y: number) => {
        const limit = limits(scale);
        const next = { scale, x: clamp(x, -limit.x, limit.x), y: clamp(y, -limit.y, limit.y) };
        scaleRef.current = next.scale;
        offsetRef.current = { x: next.x, y: next.y };
        markZoomed(next.scale);
        zoomApi.start({ ...next, immediate: true });
    };

    // Gesture over: back inside the real limits, springing there from wherever it was let go.
    const settleZoom = (scale: number, x: number, y: number, immediate = false) => {
        const next = clamp(scale, 1, MAX_SCALE);
        const limit = limits(next);
        const settled = { scale: next, x: clamp(x, -limit.x, limit.x), y: clamp(y, -limit.y, limit.y) };
        scaleRef.current = settled.scale;
        offsetRef.current = { x: settled.x, y: settled.y };
        markZoomed(settled.scale);
        zoomApi.start({ ...settled, immediate, config: SNAP });
    };

    // Nothing may end a drag by simply walking away from it: a swipe abandoned part-way — the
    // second finger of a pinch landing, an animation already running — has to put the carousel
    // back, or the neighbouring photo is left sitting across this one for good.
    const abandonDrag = () => {
        directionRef.current = undefined;
        carouselApi.start({ x: 0, y: 0, opacity: 1, scale: 1, config: SNAP });
    };

    const toggleDoubleTapZoom = (clientX: number, clientY: number) => {
        if (scaleRef.current > 1 + ZOOMED_EPSILON) {
            settleZoom(1, 0, 0);
            return;
        }
        const box = viewport();
        const photo = photoSize();
        const scale = clamp(
            Math.max(box.width / photo.width, box.height / photo.height),
            DOUBLE_TAP_MIN_SCALE,
            MAX_SCALE
        );
        const focus = { x: clientX - box.width / 2, y: clientY - box.height / 2 };
        settleZoom(scale, focalOffset(0, focus.x, focus.x, 1, scale), focalOffset(0, focus.y, focus.y, 1, scale));
    };

    const handleTap = (clientX: number, clientY: number) => {
        const last = lastTapRef.current;
        const now = Date.now();
        const isDouble = now - last.time < DOUBLE_TAP_WINDOW_MS
            && Math.hypot(clientX - last.x, clientY - last.y) < DOUBLE_TAP_SLOP_PX;

        lastTapRef.current = isDouble ? { time: 0, x: 0, y: 0 } : { time: now, x: clientX, y: clientY };
        if (isDouble && canZoom) toggleDoubleTapZoom(clientX, clientY);
    };

    useGesture({
        onDrag: async ({ down, movement, event, touches, tap, xy, first, cancel }) => {
            event.stopPropagation();

            if (tap) {
                if (!animatingRef.current) handleTap(xy[0], xy[1]);
                return;
            }

            // A pinch owns the surface while it lasts, and it takes over from a drag that has
            // already moved the carousel — so that drag has to be put back, not just dropped.
            if (pinchingRef.current || touches > 1) {
                abandonDrag();
                cancel();
                return;
            }

            // A drag that arrives while a move is animating is turned away on its first event,
            // before it has moved anything, so there is nothing of it to put back — and the
            // carousel belongs to the animation until that finishes.
            if (animatingRef.current) {
                directionRef.current = undefined;
                cancel();
                return;
            }

            // Zoomed in, a drag moves the photo around inside the window rather than moving to
            // the photo next door.
            if (scaleRef.current > 1 + ZOOMED_EPSILON) {
                if (first) panStartRef.current = offsetRef.current;
                showZoom(
                    scaleRef.current,
                    panStartRef.current.x + movement[0],
                    panStartRef.current.y + movement[1]
                );
                return;
            }

            let [omx, omy] = movement;

            if (!directionRef.current) {
                if (Math.abs(omy) > DIRECTION_THRESHOLD_PX) {
                    directionRef.current = 'vertical';
                } else if (Math.abs(omx) > DIRECTION_THRESHOLD_PX) {
                    directionRef.current = 'horizontal';
                }
            }

            if (directionRef.current === 'vertical') omx = 0;
            if (directionRef.current === 'horizontal') omy = 0;

            // Smoothly transition between swipe and dismiss
            const dismissPercent = omy / (window.innerHeight / 2);
            const swipePercent = omx / (window.innerWidth / 2);
            const mx = omx * (1 - dismissPercent);
            const my = omy * (1 - swipePercent);

            if (down) {
                carouselApi.start({
                    x: mx,
                    y: my,
                    opacity: 1 - Math.abs(my) / window.innerHeight,
                    scale: 1 - Math.abs(my) / window.innerHeight,
                    immediate: true
                });
                return;
            }

            directionRef.current = undefined;

            if (Math.abs(mx) > window.innerWidth / 6) {
                // Snap to next/previous if swiped far enough
                animatingRef.current = true;
                try {
                    if (mx > 0) {
                        await Promise.all(carouselApi.start({ x: window.innerWidth, config: SNAP }));
                        onMovePrevious?.();
                    } else {
                        await Promise.all(carouselApi.start({ x: -window.innerWidth, config: SNAP }));
                        onMoveNext?.();
                    }
                    carouselApi.start({ x: 0, immediate: true });
                } finally {
                    animatingRef.current = false;
                }
            } else if (Math.abs(my) > window.innerHeight / 4) {
                // Animate closed
                animatingRef.current = true;
                try {
                    await Promise.all(carouselApi.start({ x: 0, y: 0, opacity: 0, scale: 0, config: SNAP }));
                    onClose?.();
                } finally {
                    animatingRef.current = false;
                }
            } else {
                // Reset if swipe is canceled
                carouselApi.start({ x: 0, y: 0, opacity: 1, scale: 1, config: SNAP });
            }
        },

        onPinchStart: ({ origin }) => {
            pinchingRef.current = true;
            pinchOriginRef.current = { x: origin[0], y: origin[1] };
        },

        onPinch: ({ offset, origin, event }) => {
            if (event.cancelable) event.preventDefault();

            const box = viewport();
            const from = pinchOriginRef.current;
            const nextScale = offset[0];

            showZoom(
                nextScale,
                focalOffset(offsetRef.current.x, from.x - box.width / 2, origin[0] - box.width / 2, scaleRef.current, nextScale),
                focalOffset(offsetRef.current.y, from.y - box.height / 2, origin[1] - box.height / 2, scaleRef.current, nextScale)
            );
            pinchOriginRef.current = { x: origin[0], y: origin[1] };
        },

        onPinchEnd: ({ offset }) => {
            pinchingRef.current = false;
            settleZoom(offset[0], offsetRef.current.x, offsetRef.current.y);
        }
    }, {
        target: surfaceRef,
        eventOptions: { passive: false },
        drag: { filterTaps: true },
        pinch: {
            enabled: canZoom,
            pointer: { touch: true },
            from: () => [scaleRef.current, 0],
            scaleBounds: { min: 1, max: MAX_SCALE },
            rubberband: true
        }
    });

    // iOS decides at the start of a gesture whether it will zoom the page, and neither
    // touch-action nor preventDefault on the pointer events reaches that decision: claiming
    // multi-touch as it begins and refusing Safari's own zoom events is what rules it out.
    useEffect(() => {
        const element = surfaceRef.current;
        if (element === null) return;

        const claimMultiTouch = (event: TouchEvent) => {
            if (event.touches.length > 1 && event.cancelable) event.preventDefault();
        };
        const blockPageZoom = (event: Event) => {
            if (event.cancelable) event.preventDefault();
        };

        element.addEventListener('touchstart', claimMultiTouch, { passive: false });
        element.addEventListener('gesturestart', blockPageZoom, { passive: false });
        element.addEventListener('gesturechange', blockPageZoom, { passive: false });

        return () => {
            element.removeEventListener('touchstart', claimMultiTouch);
            element.removeEventListener('gesturestart', blockPageZoom);
            element.removeEventListener('gesturechange', blockPageZoom);
        };
    }, [surfaceRef]);

    // A different photo arrives at its own size, and nothing of the last one's gesture carries
    // over to it.
    useEffect(() => {
        pinchingRef.current = false;
        directionRef.current = undefined;
        settleZoom(1, 0, 0, true);
    }, [itemIndex, item?.itemId]);

    // Moving by keyboard or by button slides the same way a swipe does, so the two can't leave
    // the carousel in different places.
    const animateMove = (move: Function, towards: number) => async () => {
        if (animatingRef.current) return;
        if (!photoAnimationsEnabled) {
            move();
            return;
        }
        animatingRef.current = true;
        try {
            await Promise.all(carouselApi.start({ x: towards * window.innerWidth, config: { tension: 500, clamp: true } }));
            move();
            carouselApi.start({ x: 0, immediate: true });
        } finally {
            animatingRef.current = false;
        }
    };

    return {
        carousel,
        zoom,
        isZoomed,
        animateMoveNext: onMoveNext && animateMove(onMoveNext, -1),
        animateMovePrevious: onMovePrevious && animateMove(onMovePrevious, 1)
    };
};
