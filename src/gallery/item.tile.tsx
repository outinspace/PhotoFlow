import { useState, useEffect, useRef } from 'react';
import { Item } from '../types';
import { HeartSolid } from 'iconoir-react';
import { observeVisibility } from '../common/visibility.observer';
import { useThumbHashDataUrl } from '../common/thumb.hash.cache';

const PLACEHOLDER_COLORS = Array.from({ length: 20 }, (_, i) => {
    const alpha = 0.9 + (i * 0.005);
    return `rgba(0,0,0,${alpha})`;
});

interface Props {
    item: Item;
    onClick: (isDoubleClick: boolean) => any;
    idealTileSize: number;
    isSelected: boolean;
}

export const ItemTile = ({ item, onClick, idealTileSize, isSelected }: Props) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const tileRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const loadedRef = useRef(false);

    const tilePlaceholderUrl = useThumbHashDataUrl(item.primaryFile.thumbHash);

    useEffect(() => {
        const element = tileRef.current;
        if (!element) return;

        const url = item.primaryFile.tileImageUrl;
        if (!url) return;

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
            className={`relative h-full w-full overflow-hidden ${idealTileSize > 50 && 'outline outline-white outline-1'}`}
            style={{
                backgroundColor: PLACEHOLDER_COLORS[item.itemId % PLACEHOLDER_COLORS.length]
            }}
            onClick={e => {
                const clickCount = e.detail;
                const isDoubleClick = clickCount > 1;
                onClick(isDoubleClick);
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
                        filter: 'blur(8px)',
                        transform: 'scale(1.3)',
                        pointerEvents: 'none',
                    }}
                    src={tilePlaceholderUrl}
                    decoding='async'
                />
            )}
            <img
                ref={imgRef}
                className='select-none'
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: imageLoaded ? 1 : 0,
                    transition: 'opacity 0.3s ease-out',
                }}
                decoding='async'
                onLoad={() => {
                    if (imgRef.current?.getAttribute('src')) {
                        loadedRef.current = true;
                        setImageLoaded(true);
                    }
                }}
            />
            {item.isFavorite && (
                <div className='absolute bottom-1 left-1 text-slate-100 shadow'>
                    <HeartSolid
                        height={idealTileSize / 6}
                        width={idealTileSize / 6}
                    />
                </div>
            )}
            {item.type === 'video' && (
                <div className='absolute bottom-1 right-1 text-slate-100 shadow leading-none font-bold' style={{ fontSize: idealTileSize / 8 }}>
                    {formatVideoSeconds(item.videoLength)}
                </div>
            )}
            {isSelected && (
                <div className='absolute top-0 bottom-0 left-0 right-0 bg-sky-500/50' />
            )}
        </div>
    );
};

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
