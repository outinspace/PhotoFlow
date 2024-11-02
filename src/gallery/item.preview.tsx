import React from 'react';
import { Item } from './types';
import styled from '@emotion/styled';
import { NavArrowLeft, NavArrowRight, Position } from 'iconoir-react';

interface Props {
    item: Item;
    onMoveNext: Function;
    onMovePrevious: Function;
}

const ItemPreview = ({ item, onMovePrevious, onMoveNext }: Props) => {
    const imageFile = item.files.find(_ => _.contentType.startsWith('image'));

    return (
        <Container>
            {imageFile && (
                <img
                    style={{
                        flex: '1 1 auto',
                        objectFit: 'contain'
                    }}
                    src={imageFile.previewUrl ?? undefined}
                />
            )}
            <div
                onClick={() => onMovePrevious()}
                style={{
                    position: 'absolute',
                    border: 'solid red 1px',
                    height: '50%',
                    width: '25%',
                    top: '25%',
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
                    border: 'solid red 1px',
                    height: '50%',
                    width: '25%',
                    top: '25%',
                    right: 0,
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
