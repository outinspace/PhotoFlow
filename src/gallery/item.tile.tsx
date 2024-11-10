import React, { useEffect, useState } from 'react';
import { Item } from './types';
import { nonSelectable } from '../styles';
import constants from '../design.constants';

interface Props {
    item: Item;
    onClick: Function;
    showBorder: boolean;
}

const placeholderColors: string[] = [];
for (let i = 0; i < 20; i++) {
    const alpha = Math.random() * 0.1 + 0.9;
    placeholderColors.push(`rgba(0,0,0,${alpha})`);
}

export const ItemTile = ({ item, onClick, showBorder }: Props) => {
    const [isHovering, setIsHovering] = useState(false);
    const [videoIsLoaded, setVideoIsLoaded] = useState(false);
    const [showImage, setShowImage] = useState(false);


    const primaryFile = item.files.find(_ => _.contentType.startsWith('image')) ?? item.files[0];
    const videoFile = item.files.find(_ => _.contentType.startsWith('video'));

    // const showLivePhoto = isHovering && videoFile;
    const showLivePhoto = false; // TODO:

    // HACK: Prevent mass loading of tile images when scrolling
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setShowImage(true);
        }, 50);

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
                    poster={primaryFile.tileImageUrl ?? undefined}
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
                src={showImage ? primaryFile.tileImageUrl ?? undefined : undefined} />
        </div>
    );
};

