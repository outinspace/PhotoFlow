import { useState, useEffect, useRef, useMemo } from 'react';
import { Item } from '../types';
import { HeartSolid } from 'iconoir-react';
import { blurhashToDataUrl } from '../utils/blurhashToDataUrl';

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
    const [showImage, setShowImage] = useState(false);
    const tileRef = useRef<HTMLDivElement>(null);

    const placeholderStyle = useMemo(() => {
        // if (!showImage) {
        //     return { backgroundColor: PLACEHOLDER_COLORS[item.itemId % PLACEHOLDER_COLORS.length] };
        // }
        const dataUrl = blurhashToDataUrl(item.primaryFile.blurHash);
        if (dataUrl) {
            return { backgroundImage: `url(${dataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' };
        }
        return { backgroundColor: PLACEHOLDER_COLORS[item.itemId % PLACEHOLDER_COLORS.length] };
    }, [showImage, item.itemId, item.primaryFile.blurHash]);

    useEffect(() => {
        const element = tileRef.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setTimeout(() => {
                            setShowImage(true);
                        }, 200);
                        observer.unobserve(element);
                    }
                });
            },
            { rootMargin: '200px' }
        );

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <div
            ref={tileRef}
            className={`h-full w-full ${idealTileSize > 50 && 'outline outline-white outline-1'}`}
            style={placeholderStyle}
            onClick={e => {
                const clickCount = e.detail;
                const isDoubleClick = clickCount > 1;
                onClick(isDoubleClick);
            }}
        >
            <img
                className='select-none'
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                }}
                src={showImage ? (item.primaryFile.tileImageUrl ?? undefined) : undefined}
                decoding='async'
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
