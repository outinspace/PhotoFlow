import React, { useState } from 'react';
import { Item } from './types';
import styled from '@emotion/styled';
import { Download, NavArrowLeft, NavArrowRight, Play, Xmark } from 'iconoir-react';
import constants from '../design.constants';
import { useKeyBindings } from '../hooks/use.key.bindings';
import { format, formatRelative, parseISO } from 'date-fns';
import { formatAsLongRelativeDateTime } from '../date.utils';

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

    useKeyBindings([
        { cmd: ['ArrowLeft'], callback: () => onMovePrevious() },
        { cmd: ['ArrowRight'], callback: () => onMoveNext() },
        { cmd: ['Escape'], callback: () => onClose() }
    ], [onMovePrevious, onMoveNext, onClose]);

    // const livePhotoLongPressHandlers = useLongPress(() => setShowLivePhoto(true), 250);

    const imageFile = item.files.find(_ => _.contentType.startsWith('image'));
    const videoFile = item.files.find(_ => _.contentType.startsWith('video'));
    const isLivePhoto = !!imageFile && !!videoFile;

    const downloadPrimaryFile = () => {
        const primaryFile = imageFile ?? item.files[0];

        open(primaryFile.originalUrl);
    };

    // TODO: https://use-gesture.netlify.app/

    return (
        <Container>
            {imageFile && <>
                <img
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        userSelect: 'none',
                        zIndex: zIndex.tileImage
                    }}
                    src={imageFile?.tileImageUrl ?? undefined}
                />
                <img
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        userSelect: 'none',
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
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        userSelect: 'none',
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
                    style={{
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        userSelect: 'none',
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
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: zIndex.controls,
                    alignItems: 'center',
                    display: 'flex'
                }}>
                <Xmark
                    onClick={() => onClose()}
                    color='white'
                    height={36}
                    width={36}
                    style={{
                        padding: constants.space.S,
                    }}
                />
                <span
                    style={{
                        color: 'white',
                        fontFamily: 'Roboto, sans-serif',
                        fontWeight: 300,
                        fontSize: 20
                    }}
                >
                    {formatAsLongRelativeDateTime(item.captureTime)}
                </span>
            </div>
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    zIndex: zIndex.controls
                }}>
                {isLivePhoto && (
                    <Play
                        onClick={() => setShowLivePhoto(true)}
                        color='white'
                        height={36}
                        width={36}
                        style={{
                            paddingTop: constants.space.S,
                            paddingRight: constants.space.S
                        }}
                    />
                )}
                <Download
                    onClick={() => downloadPrimaryFile()}
                    color='white'
                    height={36}
                    width={36}
                    style={{
                        paddingTop: constants.space.S,
                        paddingRight: constants.space.S
                    }}
                />
            </div>
        </Container>
    );
};

function renderNextButton(onMoveNext: Function) {
    return <div
        onClick={() => onMoveNext()}
        style={{
            position: 'absolute',
            height: '50%',
            width: '25%',
            top: '25%',
            right: 0,
            padding: constants.space.S,
            alignItems: 'center',
            justifyContent: 'end',
            display: 'flex',
            zIndex: zIndex.controls
        }}>
        <NavArrowRight
            color='white'
            height={36}
            width={36} />
    </div>;
}

function renderPreviousButton(onMovePrevious: Function) {
    return <div
        onClick={() => onMovePrevious()}
        style={{
            position: 'absolute',
            height: '50%',
            width: '25%',
            top: '25%',
            padding: constants.space.S,
            alignItems: 'center',
            justifyContent: 'start',
            display: 'flex',
            zIndex: zIndex.controls
        }}>
        <NavArrowLeft
            color='white'
            height={36}
            width={36} />
    </div>;
}

const Container = styled.div`
    background-color: black;
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
`;

export default ItemPreview;

