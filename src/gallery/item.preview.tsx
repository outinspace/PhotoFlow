import React, { useState } from 'react';
import { Item } from '../types';
import styled from '@emotion/styled';
import { Menu, NavArrowLeft, NavArrowRight, Play, Trash, Xmark } from 'iconoir-react';
import constants from '../design.constants';
import { useKeyBindings } from '../hooks/use.key.bindings';
import { formatAsLongRelativeDateTime } from '../date.utils';
import { nonSelectable } from '../styles';
import ItemActionMenu from '../common/item.action.menu';

interface Props {
    item: Item;
    onMoveNext: Function;
    onMovePrevious: Function;
    onClose: Function;
}

const zIndex = {
    controls: 10,
    previewVideo: 3,
    previewImage: 2,
    tileImage: 1
};

const ItemPreview = ({ item, onMovePrevious, onMoveNext, onClose }: Props) => {
    const [showLivePhoto, setShowLivePhoto] = useState(false);
    const [showActionMenu, setShowActionMenu] = useState(false);

    useKeyBindings([
        { cmd: ['ArrowLeft'], callback: () => onMovePrevious() },
        { cmd: ['ArrowRight'], callback: () => onMoveNext() },
        { cmd: ['Escape'], callback: () => onClose() }
    ], [onMovePrevious, onMoveNext, onClose]);

    // const livePhotoLongPressHandlers = useLongPress(() => setShowLivePhoto(true), 250);

    const imageFile = item.files.find(_ => _.contentType.startsWith('image'));
    const videoFile = item.files.find(_ => _.contentType.startsWith('video'));
    const isLivePhoto = !!imageFile && !!videoFile;

    // TODO: https://use-gesture.netlify.app/

    const heading = formatAsLongRelativeDateTime(item.captureTime);
    const subheading = [
        item.city,
        item.region
    ]
        .filter(_ => !!_)
        .join(', ');

    return (
        <div className='bg-black fixed top-0 bottom-0 left-0 right-0 flex flex-col z-10'>
            <div className='flex justify-between p-3'>
                <div
                    className='flex'>
                    <Xmark
                        onClick={() => onClose()}
                        color={constants.colors.text.level0}
                        height={36}
                        width={36}
                        className="mr-3"
                    />
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
                <div className='flex drop-shadow text-white'>
                    {isLivePhoto && (
                        <Play
                            onClick={() => setShowLivePhoto(true)}
                            height={36}
                            width={36}
                            className='mr-3'
                        />
                    )}
                    <Menu
                        height={36}
                        width={36}
                        onClick={() => setShowActionMenu(true)}
                    />
                </div>
            </div>
            <div className='w-full flex flex-auto justify-center static'>
                {imageFile && <>
                    <img
                        className={'select-none absolute w-full h-full object-contain'}
                        src={imageFile?.tileImageUrl ?? undefined}
                    />
                    <img
                        className={'select-none absolute w-full h-full object-contain'}
                        src={imageFile.previewUrl ?? undefined}
                    />
                </>}
                {isLivePhoto && showLivePhoto && (
                    <video
                        autoPlay
                        controls={false}
                        playsInline
                        className={'select-none absolute w-full h-full object-contain'}
                        onEnded={() => setShowLivePhoto(false)}
                    >
                        <source src={videoFile.previewUrl ?? undefined} />
                    </video>
                )}
                {videoFile && !isLivePhoto && (
                    <video
                        autoPlay
                        controls
                        playsInline
                        className={'select-none absolute w-full h-full object-contain'}
                        onEnded={() => setShowLivePhoto(false)}
                    >
                        <source src={videoFile.previewUrl ?? undefined} />
                    </video>
                )}
            </div>
            <div className='flex justify-between p-3'>
                <Trash
                    className='h-10 w-10 text-white'
                />
                <Trash
                    className='h-10 w-10 text-white'
                />
            </div>
            {renderPreviousButton(onMovePrevious)}
            {renderNextButton(onMoveNext)}
            <ItemActionMenu
                item={item}
                isOpen={showActionMenu}
                onDismiss={() => setShowActionMenu(false)}
            />
        </div>
    );
};

function renderNextButton(onMoveNext: Function) {
    return <div
        onClick={() => onMoveNext()}
        className='flex absolute right-0 z-10 top-1/4 bottom-1/4 mr-3 items-center justify-end w-1/5 drop-shadow'
    >
        <NavArrowRight
            color={constants.colors.text.level0}
            height={36}
            width={36} />
    </div>;
}

function renderPreviousButton(onMovePrevious: Function) {
    return <div
        onClick={() => onMovePrevious()}
        className='flex absolute left-0 z-10 top-1/4 bottom-1/4 ml-3 items-center justify-start w-1/5 drop-shadow'
    >
        <NavArrowLeft
            color={constants.colors.text.level0}
            height={36}
            width={36} />
    </div>;
}

export default ItemPreview;

