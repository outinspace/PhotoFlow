import { useEffect, useRef, useState } from 'react';
import { Item } from '../types';
import { InfoCircle, Heart, HeartSolid, Xmark, Play, Pause } from 'iconoir-react';
import { useKeyBindings } from '../hooks/use.key.bindings';
import ItemInfoSheet from './item.info.sheet';
import { differenceInDays, format } from 'date-fns';
import { ItemActionMenu } from './item.action.menu';
import { Ellipsis } from '../common/ellipsis';
import { animated, useSpring } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import ItemMedia from './item.media';
import { useFavoriteItem } from '../api/useFavoriteItem';
import { useUnfavoriteItem } from '../api/useUnfavoriteItem';
import { usePhotoAnimations, useSlideshowInterval } from '../hooks/use.settings';

interface Props {
    items: Item[];
    itemIndex: number;
    albumId: number | null,
    onMoveNext?: Function;
    onMovePrevious?: Function;
    onClose?: Function;
    readonly?: boolean;
}

const SLIDESHOW_VIDEO_MAX_SECONDS = 15;

const ItemPreview = ({ items, itemIndex, albumId, onMovePrevious, onMoveNext, onClose, readonly }: Props) => {
    const [showInfoSheet, setShowInfoSheet] = useState(false);
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [slideshow, setSlideshow] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const favoriteItem = useFavoriteItem();
    const unfavoriteItem = useUnfavoriteItem();
    const [photoAnimationsEnabled] = usePhotoAnimations();
    const [slideshowSeconds] = useSlideshowInterval();

    const item: Item | undefined = items[itemIndex];

    const [swipeSpring, swipeApi] = useSpring(() => ({ x: 0, y: 0, opacity: 1, scale: 1 }));
    const currentGestureDirection = useRef<'vertical' | 'horizontal'>();

    const dragBindings = useDrag(async ({ down, movement, event, touches }) => {
        event.stopPropagation();

        // Prevent new gestures during animations
        if (isAnimating) {
            return;
        }

        // Check if the page is zoomed in or if it's a pinch gesture
        if (touches > 1) {
            return; // Prevent dragging during pinch gestures
        }
        
        // More reliable zoom detection
        const visualViewport = window.visualViewport;
        if (visualViewport && visualViewport.scale > 1) {
            return; // Prevent dragging if zoomed in
        }

        let [omx, omy] = movement;

        if (!currentGestureDirection.current) {
            if (Math.abs(omy) > 10) {
                currentGestureDirection.current = 'vertical';
            } else if (Math.abs(omx) > 10) {
                currentGestureDirection.current = 'horizontal';
            }
        }

        if (currentGestureDirection.current === 'vertical') {
            omx = 0;
        }

        if (currentGestureDirection.current === 'horizontal') {
            omy = 0;
        }


        // Smoothly transition between swipe and dismiss
        const dismissPercent = omy / (window.innerHeight / 2);
        const swipePercent = omx / (window.innerWidth / 2);
        const mx = omx * (1 - dismissPercent);
        const my = omy * (1 - swipePercent);

        // Track user drag
        if (down) {
            swipeApi.start({
                x: mx,
                y: my,
                opacity: 1 - Math.abs(my) / window.innerHeight,
                scale: 1 - Math.abs(my) / window.innerHeight,
                immediate: true
            });
            return;
        }

        if (Math.abs(mx) > window.innerWidth / 6) {
            // Snap to next/previous if swiped far enough
            setIsAnimating(true);
            const direction = mx > 0 ? -1 : 1;
            if (direction === -1) {
                await Promise.all(swipeApi.start({
                    x: window.innerWidth,
                    config: { tension: 300, clamp: true }
                }));
                onMovePrevious?.();
            } else {
                await Promise.all(swipeApi.start({
                    x: -window.innerWidth,
                    config: { tension: 300, clamp: true }
                }));
                onMoveNext?.();
            }
            // Reset position
            swipeApi.start({ x: 0, immediate: true });
            setIsAnimating(false);
        } else if (Math.abs(my) > window.innerHeight / 4) {
            // Animate closed
            setIsAnimating(true);
            await Promise.all(swipeApi.start({
                x: 0,
                y: 0,
                opacity: 0,
                scale: 0,
                config: { tension: 300, clamp: true }
            }));

            onClose?.();
            setIsAnimating(false);
        } else {
            // Reset if swipe is canceled
            swipeApi.start({
                x: 0,
                y: 0,
                opacity: 1,
                scale: 1,
                config: { tension: 300, clamp: true }
            });
        }

        // Reset current gesture direction only when gesture ends
        if (!down) {
            currentGestureDirection.current = undefined;
        }
    }, {
        filterTaps: true
    });

    let animateMoveNext: Function;
    let animateMovePrev: Function;

    if (onMoveNext) {
        animateMoveNext = async () => {
            if (isAnimating) return;
            
            if (photoAnimationsEnabled) {
                setIsAnimating(true);
                await Promise.all(swipeApi.start({
                    x: -window.innerWidth,
                    config: { tension: 500, clamp: true }
                }));
                onMoveNext();
                swipeApi.start({ x: 0, immediate: true }); // Reset position
                setIsAnimating(false);
            } else {
                // No animation, just move immediately
                onMoveNext();
            }
        };
    }

    if (onMovePrevious) {
        animateMovePrev = async () => {
            if (isAnimating) return;
            
            if (photoAnimationsEnabled) {
                setIsAnimating(true);
                await Promise.all(swipeApi.start({
                    x: window.innerWidth,
                    config: { tension: 500, clamp: true }
                }));
                onMovePrevious();
                swipeApi.start({ x: 0, immediate: true }); // Reset position
                setIsAnimating(false);
            } else {
                // No animation, just move immediately
                onMovePrevious();
            }
        };
    }

    useKeyBindings([
        { cmd: ['ArrowLeft'], callback: () => animateMovePrev?.() },
        { cmd: ['ArrowRight'], callback: () => animateMoveNext?.() },
        { cmd: ['Escape'], callback: () => onClose?.() }
    ], [onMovePrevious, onMoveNext, onClose]);

    const startSlideshow = async () => {
        try {
            await containerRef.current?.requestFullscreen();
        } catch {
            // Continue without fullscreen if denied
        }
        setSlideshow(true);
    };

    const stopSlideshow = () => {
        setSlideshow(false);
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
    };

    useEffect(() => {
        if (!slideshow) return;

        const isVideo = item?.type === 'video';
        const durationSeconds = isVideo
            ? Math.min(item.videoLength ?? SLIDESHOW_VIDEO_MAX_SECONDS, SLIDESHOW_VIDEO_MAX_SECONDS)
            : slideshowSeconds;

        const timeoutId = setTimeout(() => {
            onMoveNext?.();
        }, durationSeconds * 1000);

        return () => clearTimeout(timeoutId);
    }, [slideshow, itemIndex, slideshowSeconds]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setSlideshow(false);
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        return () => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        };
    }, []);

    if (!item) {
        return;
    }

    const heading = formatRelativeOrLongDateTime(item.captureTime);
    const subheading = [
        item.type === 'live-photo' ? 'Live' : null,
        item.city && item.region ? `${item.city}, ${item.region}` : null
    ]
        .filter(_ => !!_)
        .join(' • ');


    return (
        <animated.div
            ref={containerRef}
            className='fixed top-0 bottom-0 left-0 right-0 flex z-10 bg-black'
            style={{ opacity: swipeSpring.opacity }}
        >
            <div
                {...dragBindings()}
                className='absolute top-0 left-0 w-full h-full touch-manipulation'
            >
                {[itemIndex - 1, itemIndex, itemIndex + 1]
                    .filter((i) => i >= 0 && i < items.length) // Only render relevant images
                    .map((i) => (
                        <animated.div
                            key={i}
                            className='absolute top-0 bottom-0 left-0 right-0'
                            style={{
                                x: swipeSpring.x.to((val) => {
                                    return (i - itemIndex) * window.innerWidth + val;
                                }),
                                y: swipeSpring.y,
                                scale: swipeSpring.scale
                            }}
                        >
                            <ItemMedia
                                isPrimary={i === itemIndex}
                                item={items[i]}
                            />
                        </animated.div>
                    ))}
            </div>
            <div
                className="absolute left-0 top-0 flex z-10 p-3 text-shadow">
                {onClose && (
                    <Xmark
                        onClick={() => onClose?.()}
                        color='white'
                        height={30}
                        width={30}
                        className="mr-3"
                    />
                )}
                <div
                    className='select-none text-white content-center font-normal'
                >
                    <div className='text-base pt-0.5'>
                        {heading}
                    </div>
                    <div className='text-sm'>
                        {subheading}
                    </div>
                </div>
            </div>
            <div className='absolute top-0 right-0 z-10 flex p-3 text-white'>
                <button
                    onClick={() => setShowInfoSheet(true)}
                    className='ml-3'
                    title='Info'
                    aria-label='Info'
                >
                    <InfoCircle height={30} width={30} className='text-shadow' />
                </button>
                {items.length > 1 && (slideshow ? (
                    <button onClick={stopSlideshow} className='ml-3' title='Stop slideshow' aria-label='Stop slideshow'>
                        <Pause height={30} width={30} className='text-shadow' />
                    </button>
                ) : (
                    <button onClick={startSlideshow} className='ml-3' title='Start slideshow' aria-label='Start slideshow'>
                        <Play height={30} width={30} className='text-shadow' />
                    </button>
                ))}
                {!readonly && !item.isFavorite && (
                    <button
                        onClick={() => favoriteItem.mutateAsync(item.itemId)}
                        className='ml-3'
                        title='Favorite'
                        aria-label='Favorite'
                    >
                        <Heart height={30} width={30} className='text-shadow' />
                    </button>
                )}
                {!readonly && item.isFavorite && (
                    <button
                        onClick={() => unfavoriteItem.mutateAsync(item.itemId)}
                        className='ml-3'
                        title='Remove favorite'
                        aria-label='Remove favorite'
                    >
                        <HeartSolid height={30} width={30} className='text-shadow' />
                    </button>
                )}
                <button
                    onClick={() => setShowActionMenu(!showActionMenu)}
                    className='ml-3'
                    title='More'
                    aria-label='More'
                >
                    <Ellipsis height={30} width={30} className='text-shadow' />
                </button>
                <ItemActionMenu
                    items={[item]}
                    albumId={albumId}
                    isOpen={showActionMenu}
                    onDismiss={() => setShowActionMenu(false)}
                    onItemsRemoved={() => onClose?.()}
                    position='bottom'
                    readonly={!!readonly}
                />
            </div>
            <ItemInfoSheet
                item={item}
                isOpen={showInfoSheet}
                onDismiss={() => setShowInfoSheet(false)}
            />
        </animated.div>
    );
};

function formatRelativeOrLongDateTime(date: Date | string) {
    const daysDifference = differenceInDays(date, new Date());

    if (Math.abs(daysDifference) > 6) {
        return format(date, 'EEEE LLL d yyyy');
    } else {
        return format(date, 'EEEE h:mm a');
    }
}

export default ItemPreview;
