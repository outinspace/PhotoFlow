import React, { useState } from 'react';
import { Item } from '../types';
import styled from '@emotion/styled';
import { Menu, NavArrowLeft, NavArrowRight, Play, Xmark } from 'iconoir-react';
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

    return (
        <Container>
            {imageFile && <>
                <img
                    className={nonSelectable}
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        zIndex: zIndex.tileImage
                    }}
                    src={imageFile?.tileImageUrl ?? undefined}
                />
                <img
                    className={nonSelectable}
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        zIndex: zIndex.previewImage
                    }}
                    src={imageFile.previewUrl ?? undefined}
                />
            </>}
            {isLivePhoto && showLivePhoto && (
                <video
                    autoPlay
                    controls={false}
                    playsInline
                    className={nonSelectable}
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        zIndex: zIndex.previewVideo
                    }}
                    onEnded={() => setShowLivePhoto(false)}
                >
                    <source src={videoFile.previewUrl ?? undefined} />
                </video>
            )}
            {videoFile && !isLivePhoto && (
                <video
                    autoPlay
                    muted
                    controls
                    playsInline
                    className={nonSelectable}
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        zIndex: zIndex.previewVideo
                    }}
                    onEnded={() => setShowLivePhoto(false)}
                >
                    <source src={videoFile.previewUrl ?? undefined} />
                </video>
            )}
            {renderPreviousButton(onMovePrevious)}
            {renderNextButton(onMoveNext)}
            <div
                className="absolute left-0 top-0 flex z-10 p-3 drop-shadow">
                <Xmark
                    onClick={() => onClose()}
                    color={constants.colors.text.level0}
                    height={36}
                    width={36}
                    className="mr-3"
                />
                <span
                    className='select-none text-white text-xl content-center font-normal'
                >
                    {formatAsLongRelativeDateTime(item.captureTime)}
                </span>
            </div>
            <div className='absolute top-0 right-0 z-10 flex p-3 drop-shadow text-white'>
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
            <ItemActionMenu
                item={item}
                isOpen={showActionMenu}
                onDismiss={() => setShowActionMenu(false)}
            />
        </Container>
    );
};

function renderNextButton(onMoveNext: Function) {
    return <div
        onClick={() => onMoveNext()}
        className='flex absolute right-0 z-10 top-1/4 bottom-1/4 mr-3 items-center justify-end w-2/5 drop-shadow'
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
        className='flex absolute left-0 z-10 top-1/4 bottom-1/4 ml-3 items-center justify-start w-2/5 drop-shadow'
        >
        <NavArrowLeft
            color={constants.colors.text.level0}
            height={36}
            width={36} />
    </div>;
}

const Container = styled.div`
    background-color: ${constants.colors.surface.level0};
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
`;

export default ItemPreview;

