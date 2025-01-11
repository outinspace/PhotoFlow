import React, { useEffect, useMemo, useState } from 'react';
import { Item } from '../types';
import { get, set } from 'idb-keyval';
import { useTileImageBuffer as useTileImageBinaryData } from '../queries';

interface Props {
    item: Item;
    onClick: Function;
    idealTileSize: number;
    isSelected: boolean;
}

const placeholderColors: string[] = [];
for (let i = 0; i < 20; i++) {
    const alpha = Math.random() * 0.1 + 0.9;
    placeholderColors.push(`rgba(0,0,0,${alpha})`);
}

export const ItemTile = ({ item, onClick, idealTileSize, isSelected }: Props) => {
    // BUG: Isn't working properly on prod. Very slow.
    // const { data: tileImageBinaryData } = useTileImageBinaryData(item.primaryFile);
    //
    // const tileImageObjectUrl = useMemo(() => {
    //     if (tileImageBinaryData) {
    //         const { buffer, contentType } = tileImageBinaryData;
    //         const blob = new Blob([buffer], { type: contentType });
    //
    //         return URL.createObjectURL(blob);
    //     }
    // }, [tileImageBinaryData]);

    const tileImageObjectUrl = item.primaryFile.tileImageUrl;

    return (
        <div
            onClick={() => onClick()}
            className={`h-full w-full ${idealTileSize > 50 && 'outline outline-black outline-1'}`}
            style={{
                backgroundColor: placeholderColors[item.itemId % placeholderColors.length]
            }}
        >
            <img
                className={'select-none'}
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: tileImageObjectUrl ? 1 : 0
                }}
                src={tileImageObjectUrl ?? ''}
            />
            {item.type === 'video' && (
                <div className='absolute bottom-1 right-1 text-slate-100/75 shadow leading-none font-bold' style={{ fontSize: idealTileSize / 8 }}>
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

