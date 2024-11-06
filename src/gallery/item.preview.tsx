import React from 'react';
import { Item } from './types';
import styled from '@emotion/styled';
import { Download, NavArrowLeft, NavArrowRight, Xmark } from 'iconoir-react';
import constants from '../design.constants';
import { useKeyBindings } from '../hooks/use.key.bindings';

interface Props {
    item: Item;
    onMoveNext: Function;
    onMovePrevious: Function;
    onClose: Function;
}

const ItemPreview = ({ item, onMovePrevious, onMoveNext, onClose }: Props) => {
    useKeyBindings([
        { cmd: ['ArrowLeft'], callback: () => onMovePrevious() },
        { cmd: ['ArrowRight'], callback: () => onMoveNext() },
        { cmd: ['Escape'], callback: () => onClose() }
    ], [onMovePrevious, onMoveNext, onClose]);

    const imageFile = item.files.find(_ => _.contentType.startsWith('image'));
    const videoFile = item.files.find(_ => _.contentType.startsWith('video'));
    const isLivePhoto = !!imageFile && !!videoFile;

    const downloadPrimaryFile = () => {
        const primaryFile = imageFile ?? item.files[0];

        open(primaryFile.originalUrl);
    };

    return (
        <Container>
            {imageFile && <>
                <img
                    style={{
                        flex: '1 1 auto',
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        userSelect: 'none'
                    }}
                    src={imageFile?.tileImageUrl ?? undefined}
                />
                <img
                    style={{
                        flex: '1 1 auto',
                        position: 'absolute',
                        objectFit: 'contain',
                        height: '100%',
                        width: '100%',
                        userSelect: 'none'
                    }}
                    src={imageFile.previewUrl ?? undefined}
                />
            </>}
            <div
                onClick={() => onMovePrevious()}
                style={{
                    position: 'absolute',
                    height: '50%',
                    width: '25%',
                    top: '25%',
                    padding: constants.space.S,
                    alignItems: 'center',
                    justifyContent: 'start',
                    display: 'flex'
                }}>
                <NavArrowLeft
                    color='white'
                    height={36}
                    width={36}
                />
            </div>
            <div
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
                    display: 'flex'
                }}>
                <NavArrowRight
                    color='white'
                    height={36}
                    width={36}
                />
            </div>
            <div
                onClick={() => onClose()}
                style={{
                    position: 'absolute',
                    padding: constants.space.S,
                    top: 0,
                    left: 0
                }}>
                <Xmark
                    color='white'
                    height={36}
                    width={36}
                />
            </div>
            <div
                onClick={() => downloadPrimaryFile()}
                style={{
                    position: 'absolute',
                    padding: constants.space.S,
                    top: 0,
                    right: 0
                }}>
                <Download
                    color='white'
                    height={36}
                    width={36}
                />
            </div>
        </Container>
    );
};

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
