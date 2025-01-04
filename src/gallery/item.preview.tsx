import React, { useState } from 'react';
import { Item } from '../types';
import styled from '@emotion/styled';
import { InfoCircle, NavArrowLeft, NavArrowRight, Play, Xmark } from 'iconoir-react';
import constants from '../design.constants';
import { useKeyBindings } from '../hooks/use.key.bindings';
import { nonSelectable } from '../styles';
import ItemInfoSheet from './item.info.sheet';
import { differenceInDays, format } from 'date-fns';
import { ItemActionMenu } from './item.action.menu';

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

    const heading = formatRelativeOrLongDateTime(item.captureTime);
    const subheading = [
        item.city,
        item.region
    ]
        .filter(_ => !!_)
        .join(', ');

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
                    controls
                    playsInline
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
                className="absolute left-0 top-0 flex z-10 p-3 text-shadow">
                <Xmark
                    onClick={() => onClose()}
                    color={constants.colors.text.level0}
                    height={30}
                    width={30}
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
            <div className='absolute top-0 right-0 z-10 flex p-3 text-white'>
                {isLivePhoto && (
                    <Play
                        onClick={() => setShowLivePhoto(true)}
                        height={30}
                        width={30}
                        className='mr-3 text-shadow'
                    />
                )}
                <InfoCircle
                    height={30}
                    width={30}
                    onClick={() => setShowActionMenu(true)}
                    className='mr-3 text-shadow'
                />
                <ItemActionMenu items={[item]} onDeleteCompletion={() => onClose()} />
            </div>
            <ItemInfoSheet
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
        className='flex absolute right-0 z-10 top-1/4 bottom-1/4 mr-3 items-center justify-end w-1/5 text-shadow'
    >
        <NavArrowRight
            color={constants.colors.text.level0}
            height={30}
            width={30} />
    </div>;
}

function renderPreviousButton(onMovePrevious: Function) {
    return <div
        onClick={() => onMovePrevious()}
        className='flex absolute left-0 z-10 top-1/4 bottom-1/4 ml-3 items-center justify-start w-1/5 text-shadow'
    >
        <NavArrowLeft
            color={constants.colors.text.level0}
            height={30}
            width={30} />
    </div>;
}

function formatRelativeOrLongDateTime(date: Date | string) {
    const daysDifference = differenceInDays(date, new Date());

    if (Math.abs(daysDifference) > 6) {
        return format(date, 'EEEE LLL d yyyy');
    } else {
        return format(date, 'EEEE h:mm a');
    }
}

const Container = styled.div`
    background-color: ${constants.colors.surface.level0};
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    z-index: 10;
`;

export default ItemPreview;

