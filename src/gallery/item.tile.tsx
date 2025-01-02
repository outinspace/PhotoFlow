import React, { useEffect, useState } from 'react';
import { Item } from '../types';
import { nonSelectable } from '../styles';
import constants from '../design.constants';

interface Props {
    item: Item;
    onClick: Function;
    showBorder: boolean;
    minTileSize: number;
}

const placeholderColors: string[] = [];
for (let i = 0; i < 20; i++) {
    const alpha = Math.random() * 0.1 + 0.9;
    placeholderColors.push(`rgba(0,0,0,${alpha})`);
}

export const ItemTile = ({ item, onClick, showBorder, minTileSize }: Props) => {
    const [isHovering, setIsHovering] = useState(false);
    const [videoIsLoaded, setVideoIsLoaded] = useState(false);
    const [showImage, setShowImage] = useState(false);

    const videoFile = item.files.find(_ => _.contentType.startsWith('video'));

    // const showLivePhoto = isHovering && videoFile;
    const showLivePhoto = false; // TODO:

    const isVideo = item.primaryFile.contentType.startsWith('video');

    // HACK: Prevent mass loading of tile images when scrolling
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setShowImage(true);
        }, 100);

        return () => clearTimeout(timeoutId);
    })


    return (
        <div
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={() => onClick()}
            style={{
                height: '100%',
                width: '100%',
                outline: showBorder ? `solid ${constants.colors.surface.level0} 1px` : undefined,
                backgroundColor: placeholderColors[item.itemId % placeholderColors.length]
            }}>
            {!!showLivePhoto && (
                // TODO: Fix white flicker
                <video
                    onCanPlay={() => setVideoIsLoaded(true)}
                    autoPlay
                    controls={false}
                    loop
                    muted
                    poster={item.primaryFile.tileImageUrl ?? undefined}
                    playsInline
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        visibility: videoIsLoaded ? 'visible' : 'hidden'
                    }}>
                    <source src={videoFile?.previewUrl ?? undefined} type="video/mp4" />
                </video>
            )}
            <img
                className={nonSelectable}
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                }}
                src={showImage ? item.primaryFile.tileImageUrl ?? undefined : undefined}
            />
            {isVideo && (
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

