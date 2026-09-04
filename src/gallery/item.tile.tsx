import { useState, useEffect, useRef, memo } from 'react';
import { Item } from '../types';
import { HeartSolid } from 'iconoir-react';
import { observeVisibility } from '../common/visibility.observer';
import { loadTile } from '../common/tile.loader';
import { useThumbHashDataUrl } from '../common/thumb.hash.cache';
import { useMediaUrl } from '../api/useMediaUrl';

const PLACEHOLDER_COLORS = Array.from({ length: 20 }, (_, i) => {
    const alpha = 0.9 + (i * 0.005);
    return `rgba(0,0,0,${alpha})`;
});

// Every tile remounts when the grid reflows at a new column count, and going back through the
// placeholder for an image the browser still has cached reads as a flash of blur. Remembering
// which tiles have loaded lets those come straight back at full quality instead.
//
// Keyed by the bucket key rather than the signed URL. A signature is only good for
// a day, so keying on the URL would treat every tile as new each morning and fade
// the whole grid back in.
const loadedTileSources = new Set<string>();

interface Props {
    item: Item;
    // Receives the item so the parent can pass a single stable callback (enables memoization).
    onClick: (item: Item, isDoubleClick: boolean) => any;
    tileSize: number;
    isSelected: boolean;
}

export const ItemTile = memo(({ item, onClick, tileSize, isSelected }: Props) => {
    // Already-loaded tiles render their image from the first frame, so they need no placeholder
    // and no fade — both of which would only show as a flicker. Fixed at mount, so that a tile
    // loading for the first time still fades in once it arrives.
    const [cached] = useState(() =>
        item.primaryFile.tileImageSource !== null && loadedTileSources.has(item.primaryFile.tileImageSource)
    );

    // Null until the URL has been signed. Already-signed tiles resolve on the first
    // render, so scrolling back over a tile does not flicker.
    const tileUrl = useMediaUrl(item.primaryFile.tileImageSource);

    const [imageLoaded, setImageLoaded] = useState(cached);
    const tileRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const loadedRef = useRef(cached);
    // Held while this tile is queued or loading, and called to give up its place.
    const releaseRef = useRef<(() => void) | null>(null);

    const tilePlaceholderUrl = useThumbHashDataUrl(cached ? null : item.primaryFile.thumbHash);

    // Both cancels and releases: the loader takes one call either way, so this can
    // be used by the image's own handlers and by scrolling out of view alike.
    const releaseSlot = () => {
        releaseRef.current?.();
        releaseRef.current = null;
    };

    useEffect(() => {
        const element = tileRef.current;
        if (!element) return;

        const source = item.primaryFile.tileImageSource;
        if (!source) return;

        // Not signed yet. This runs again when it is, because tileUrl is a dependency.
        if (!tileUrl) return;

        // Its src is set during render instead, so there's nothing to wait for.
        if (loadedTileSources.has(source)) return;

        const cancelPending = () => {
            releaseSlot();

            const img = imgRef.current;
            if (img && img.getAttribute('src')) {
                img.src = '';
                img.removeAttribute('src');
            }
        };

        const unobserve = observeVisibility(element, (isIntersecting) => {
            if (isIntersecting) {
                // Already loaded, or already waiting its turn.
                if (loadedRef.current || releaseRef.current) return;

                releaseRef.current = loadTile(() => {
                    if (imgRef.current) {
                        imgRef.current.src = tileUrl;
                    }
                });
            } else if (!loadedRef.current) {
                // Scrolled away. A request that had not started is dropped here
                // rather than left to arrive for a tile nobody is looking at.
                cancelPending();
            }
        });

        return () => {
            cancelPending();
            unobserve();
        };
    }, [item.primaryFile.tileImageSource, tileUrl]);

    return (
        <div
            ref={tileRef}
            className={`relative h-full w-full overflow-hidden ${tileSize > 50 && 'outline outline-white outline-1'}`}
            style={{
                backgroundColor: PLACEHOLDER_COLORS[item.itemId % PLACEHOLDER_COLORS.length]
            }}
            onClick={e => {
                const clickCount = e.detail;
                const isDoubleClick = clickCount > 1;
                onClick(item, isDoubleClick);
            }}
        >
            {tilePlaceholderUrl && (
                <img
                    aria-hidden
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        pointerEvents: 'none',
                    }}
                    src={tilePlaceholderUrl}
                    decoding='async'
                />
            )}
            <img
                ref={imgRef}
                className='select-none'
                src={cached ? (tileUrl ?? undefined) : undefined}
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: imageLoaded ? 1 : 0,
                    transition: cached ? undefined : 'opacity 0.3s ease-out',
                }}
                decoding='async'
                onLoad={() => {
                    releaseSlot();

                    const source = item.primaryFile.tileImageSource;
                    if (source && imgRef.current?.getAttribute('src')) {
                        loadedTileSources.add(source);
                        loadedRef.current = true;
                        setImageLoaded(true);
                    }
                }}
                // Freed on failure too, or one broken picture would hold a
                // connection back from every tile after it.
                onError={releaseSlot}
            />
            {item.isFavorite && (
                <div className='absolute bottom-1 left-1 text-slate-100 shadow'>
                    <HeartSolid
                        height={tileSize / 6}
                        width={tileSize / 6}
                    />
                </div>
            )}
            {item.type === 'video' && (
                <div className='absolute bottom-1 right-1 text-slate-100 shadow leading-none font-bold' style={{ fontSize: tileSize / 8 }}>
                    {formatVideoSeconds(item.videoLength)}
                </div>
            )}
            {isSelected && (
                <div className='absolute top-0 bottom-0 left-0 right-0 bg-sky-500/50' />
            )}
        </div>
    );
});

function formatVideoSeconds(inputSeconds: number | null) {
    if (!inputSeconds) {
        return '';
    }

    const date = new Date(inputSeconds * 1000);
    const fullTime = date.toISOString().slice(11, 19);

    const hours = fullTime.slice(0, 3);
    const minutesAndSeconds = fullTime.slice(3);

    let outputString = '';

    if (date.getUTCHours() > 0) {
        outputString += hours;
    }

    outputString += minutesAndSeconds;

    return outputString;
}
