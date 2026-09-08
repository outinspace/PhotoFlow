import { useEffect, useRef, useState } from 'react';
import { Item } from '../types';
import { InfoCircle, Heart, HeartSolid, Xmark, Play, Pause } from 'iconoir-react';
import { useKeyBindings } from '../hooks/use.key.bindings';
import ItemInfoSheet from './item.info.sheet';
import { differenceInDays, format } from 'date-fns';
import { ItemActionMenu } from './item.action.menu';
import { Ellipsis } from '../common/ellipsis';
import { animated } from '@react-spring/web';
import ItemMedia from './item.media';
import { usePreviewGestures } from './use.preview.gestures';
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
    const [slideshow, setSlideshow] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const surfaceRef = useRef<HTMLDivElement>(null);
    const favoriteItem = useFavoriteItem();
    const unfavoriteItem = useUnfavoriteItem();
    const [photoAnimationsEnabled] = usePhotoAnimations();
    const [slideshowSeconds] = useSlideshowInterval();

    const item: Item | undefined = items[itemIndex];

    const { carousel, zoom, isZoomed, animateMoveNext, animateMovePrevious } = usePreviewGestures({
        surfaceRef,
        item,
        itemIndex,
        // A video keeps the browser's own touch handling so that its controls still work.
        canZoom: item?.type !== 'video',
        photoAnimationsEnabled,
        onMoveNext,
        onMovePrevious,
        onClose
    });

    useKeyBindings([
        { cmd: ['ArrowLeft'], callback: () => animateMovePrevious?.() },
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
            className='fixed top-0 bottom-0 left-0 right-0 flex z-10 bg-black overflow-hidden'
            style={{ opacity: carousel.opacity }}
        >
            <div
                ref={surfaceRef}
                className={`absolute top-0 left-0 w-full h-full ${item.type === 'video' ? 'touch-manipulation' : 'touch-none'}`}
            >
                {[itemIndex - 1, itemIndex, itemIndex + 1]
                    .filter((i) => i >= 0 && i < items.length)
                    .map((i) => (
                        <animated.div
                            key={i}
                            className='absolute top-0 bottom-0 left-0 right-0'
                            style={{
                                x: carousel.x.to((val) => {
                                    return (i - itemIndex) * window.innerWidth + val;
                                }),
                                y: carousel.y,
                                scale: carousel.scale
                            }}
                        >
                            {/* The zoom rides in its own layer inside the carousel's, so panning a
                                zoomed photo can't be confused with the swipe that moves between them.
                                Only the photo being looked at takes the zoom: a neighbour at six times
                                its size would reach well past its own width and cover the one in
                                front. */}
                            <animated.div
                                className='absolute top-0 bottom-0 left-0 right-0'
                                style={{
                                    x: zoom.x.to(val => (i === itemIndex ? val : 0)),
                                    y: zoom.y.to(val => (i === itemIndex ? val : 0)),
                                    scale: zoom.scale.to(val => (i === itemIndex ? val : 1))
                                }}
                            >
                                <ItemMedia
                                    isPrimary={i === itemIndex}
                                    item={items[i]}
                                />
                            </animated.div>
                        </animated.div>
                    ))}
            </div>
            <div
                className={`absolute left-0 top-0 flex z-10 p-3 text-shadow transition-opacity duration-200 ${isZoomed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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
            <div className={`absolute top-0 right-0 z-10 flex p-3 text-white transition-opacity duration-200 ${isZoomed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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
