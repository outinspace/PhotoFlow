import React, { useEffect, useState } from 'react';
import { Item } from '../types';
import useLongPress from '../hooks/use.long.press';

interface Props {
    item: Item;
    onClick: Function;
    onHold: Function;
    minTileSize: number;
    isSelected: boolean;
}

const placeholderColors: string[] = [];
for (let i = 0; i < 20; i++) {
    const alpha = Math.random() * 0.1 + 0.9;
    placeholderColors.push(`rgba(0,0,0,${alpha})`);
}

export const ItemTile = ({ item, onClick, onHold, minTileSize, isSelected }: Props) => {
    const [showImage, setShowImage] = useState(false);

    // HACK: Prevent mass loading of tile images when scrolling
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setShowImage(true);
        }, 100);

        return () => clearTimeout(timeoutId);
    });

    const longPressHandlers = useLongPress(
        () => onHold(),
        () => onClick()
    );

    return (
        <div
            {...longPressHandlers}
            className={`h-full w-full ${minTileSize > 50 && 'border-black border-b border-r'}`}
            style={{
                backgroundColor: placeholderColors[item.itemId % placeholderColors.length]
            }}
        >
            <img
                className={`select-none ${isSelected && 'border-4 border-sky-400'}`}
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                }}
                src={showImage ? item.primaryFile.tileImageUrl ?? undefined : undefined}
            />
            {item.type === 'video' && (
                <div className='absolute bottom-1 right-1 text-slate-100/75 shadow leading-none font-bold' style={{ fontSize: minTileSize / 8 }}>
                    {formatVideoSeconds(item.videoLength)}
                </div>
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

