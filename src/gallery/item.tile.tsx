import { useState, useEffect, useRef, memo } from 'react';
import { Item } from '../types';
import { HeartSolid } from 'iconoir-react';
import { observeVisibility } from '../common/visibility.observer';
import { useThumbHashDataUrl } from '../common/thumb.hash.cache';

const PLACEHOLDER_COLORS = Array.from({ length: 20 }, (_, i) => {
    const alpha = 0.9 + (i * 0.005);
    return `rgba(0,0,0,${alpha})`;
});

// Every tile remounts when the grid reflows at a new column count, and going back through the
// placeholder for an image the browser still has cached reads as a flash of blur. Remembering
// which tiles have loaded lets those come straight back at full quality instead.
const loadedTileUrls = new Set<string>();

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
        item.primaryFile.tileImageUrl !== null && loadedTileUrls.has(item.primaryFile.tileImageUrl)
    );

    const [imageLoaded, setImageLoaded] = useState(cached);
    const tileRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const loadedRef = useRef(cached);

    const tilePlaceholderUrl = useThumbHashDataUrl(cached ? null : item.primaryFile.thumbHash);

    useEffect(() => {
        const element = tileRef.current;
        if (!element) return;

        const url = item.primaryFile.tileImageUrl;
        if (!url) return;

        // Its src is set during render instead, so there's nothing to wait for.
        if (loadedTileUrls.has(url)) return;

        let timeoutId: number | null = null;

        const cancelPending = () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            const img = imgRef.current;
            if (img && img.getAttribute('src')) {
                img.src = '';
                img.removeAttribute('src');
            }
        };

        const startLoad = () => {
            const img = imgRef.current;
            if (!img) return;
            img.src = url;
        };

        const unobserve = observeVisibility(element, (isIntersecting) => {
            if (isIntersecting) {
                if (loadedRef.current || timeoutId !== null) return;
                timeoutId = window.setTimeout(() => {
                    timeoutId = null;
                    startLoad();
                }, 200);
            } else if (!loadedRef.current) {
                cancelPending();
            }
        });

        return () => {
            cancelPending();
            unobserve();
        };
    }, [item.primaryFile.tileImageUrl]);

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
                src={cached ? item.primaryFile.tileImageUrl! : undefined}
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
                    const src = imgRef.current?.getAttribute('src');
                    if (src) {
                        loadedTileUrls.add(src);
                        loadedRef.current = true;
                        setImageLoaded(true);
                    }
                }}
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
