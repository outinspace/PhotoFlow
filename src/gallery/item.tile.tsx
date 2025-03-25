import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Item } from '../types';
import { get, set } from 'idb-keyval';
import { useTileImageBuffer as useTileImageBinaryData } from '../queries';
import toast from 'react-hot-toast';

interface Props {
    item: Item;
    onClick: (isDoubleClick: boolean) => any;
    idealTileSize: number;
    isSelected: boolean;
    'data-testid'?: string;
}

const placeholderColors: string[] = [];
for (let i = 0; i < 20; i++) {
    const alpha = Math.random() * 0.1 + 0.9;
    placeholderColors.push(`rgba(0,0,0,${alpha})`);
}

// TODO: Maybe try fetching the image after timeout in a single tile hook
export const ItemTile = ({ item, onClick, idealTileSize, isSelected, 'data-testid': dataTestId }: Props) => {
    // const cachedTileImage = useTileImageBuffer(item.primaryFile);

    // const tileImageObjectUrl = useMemo(() => {
    //     if (cachedTileImage) {
    //         const { buffer, contentType } = cachedTileImage;
    //         const blob = new Blob([buffer], { type: contentType });
    //         return URL.createObjectURL(blob);
    //     }
    // }, [cachedTileImage]);

    // const tileImageUrl = tileImageObjectUrl ?? undefined;

    const [imageReady, setImageReady] = useState(false);

    return (
        <div
            data-testid={dataTestId}
            className={`h-full w-full ${idealTileSize > 50 && 'outline outline-white outline-1'}`}
            style={{
                backgroundColor: placeholderColors[item.itemId % placeholderColors.length]
            }}
            onClick={e => {
                const clickCount = e.detail;
                const isDoubleClick = clickCount > 1;
                onClick(isDoubleClick);
            }}
        >
            <img
                onLoad={() => setImageReady(true)}
                className={'select-none transition-opacity duration-150'}
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: imageReady ? 1 : 0
                }}
                src={item.primaryFile.tileImageUrl ?? undefined}
                loading='lazy'
            />
            {item.type === 'video' && (
                <div className='absolute bottom-1 right-1 text-slate-100/75 shadow leading-none font-bold' style={{ fontSize: idealTileSize / 8 }}>
                    {formatVideoSeconds(item.videoLength)}
                </div>
            )}
            {isSelected && (
                <div data-testid="selection-overlay" className='absolute top-0 bottom-0 left-0 right-0 bg-sky-500/50' />
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

