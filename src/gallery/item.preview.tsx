import React, { useRef, useState } from 'react';
import { Item } from '../types';
import styled from '@emotion/styled';
import { InfoCircle, Play, Xmark } from 'iconoir-react';
import constants from '../design.constants';
import { useKeyBindings } from '../hooks/use.key.bindings';
import { nonSelectable } from '../styles';
import ItemInfoSheet from './item.info.sheet';
import { differenceInDays, format } from 'date-fns';
import { ItemActionMenu } from './item.action.menu';
import { Ellipsis } from '../common/ellipsis';
import { animated, useSpring, useTransition } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

interface Props {
    items: Item[];
    itemIndex: number;
    albumId: number | null,
    onMoveNext?: Function;
    onMovePrevious?: Function;
    onClose?: Function;
    readonly?: boolean;
}

const zIndex = {
    controls: 10,
    previewVideo: 3,
    previewImage: 2,
    tileImage: 1
};

const ItemPreview = ({ items, itemIndex, albumId, onMovePrevious, onMoveNext, onClose, readonly }: Props) => {
    const [showLivePhoto, setShowLivePhoto] = useState(false);
    const [showInfoSheet, setShowInfoSheet] = useState(false);
    const [showActionMenu, setShowActionMenu] = useState(false);

    const item = items[itemIndex];
    const imageFile = item.files.find(_ => _.contentType.startsWith('image'));
    const videoFile = item.files.find(_ => _.contentType.startsWith('video'));
    const isLivePhoto = !!imageFile && !!videoFile;

    const direction = useRef<'ltr' | 'rtl' | null>(null);

    const mediaTransitions = useTransition(item, {
        key: item,
        from: {
            x: direction.current === null ? '0%' : (direction.current === 'ltr' ? '-100%' : '100%')
        },
        enter: {
            x: '0%'
        },
        leave: {
            x: direction.current === null ? '0%' : (direction.current === 'ltr' ? '100%' : '-100%')
        }
    });

    const [swipeSpring, swipeApi] = useSpring(() => ({ x: 0 }));

    const bind = useDrag(async ({ down, movement }) => {
        const width = window.innerWidth;
        const mx = movement[0];

        if (!down && Math.abs(mx) > width / 2) {
            // Snap to next/previous if swiped far enough
            const direction = mx > 0 ? -1 : 1;
            if (direction === -1) {
                await Promise.all(swipeApi.start({ x: width }));
                onMovePrevious?.();
            } else {
                await Promise.all(swipeApi.start({ x: -width }));
                onMoveNext?.();
            }
            swipeApi.start({ x: 0, immediate: true }); // Reset position
        } else if (!down) {
            // Reset if swipe is canceled
            swipeApi.start({ x: 0 });
        } else {
            // Follow user's drag
            swipeApi.start({ x: mx, immediate: true });
        }
    });

    let animateMoveNext: Function;
    let animateMovePrev: Function;

    if (onMoveNext) {
        animateMoveNext = async () => {
            await Promise.all(swipeApi.start({
                x: -window.innerWidth,
                config: { tension: 500, clamp: true }
            }));
            onMoveNext();
            swipeApi.start({ x: 0, immediate: true }); // Reset position
        };
    }

    if (onMovePrevious) {
        animateMovePrev = async () => {
            await Promise.all(swipeApi.start({
                x: window.innerWidth,
                config: { tension: 500, clamp: true }
            }));
            onMovePrevious();
            swipeApi.start({ x: 0, immediate: true }); // Reset position
        };
    }

    useKeyBindings([
        { cmd: ['ArrowLeft'], callback: () => animateMovePrev?.() },
        { cmd: ['ArrowRight'], callback: () => animateMoveNext?.() },
        { cmd: ['Escape'], callback: () => onClose?.() }
    ], [onMovePrevious, onMoveNext, onClose]);

    const heading = formatRelativeOrLongDateTime(item.captureTime);
    const subheading = [
        item.city,
        item.region
    ]
        .filter(_ => !!_)
        .join(', ');


    return (
        <Container
            onDoubleClick={() => setShowLivePhoto(true)}
        >
            {[itemIndex - 1, itemIndex, itemIndex + 1]
                .filter((i) => i >= 0 && i < items.length) // Only render relevant images
                .map((i) => (
                    <animated.div
                        key={i}
                        className='absolute top-0 bottom-0 left-0 right-0'
                        style={{
                            transform: swipeSpring.x.to((val) => {
                                const offset = (i - itemIndex) * window.innerWidth + val;
                                return `translateX(${offset}px)`;
                            })
                        }}
                    >
                        <ItemMedia
                            item={items[i]}
                            showLivePhoto={showLivePhoto}
                            setShowLivePhoto={setShowLivePhoto}
                        />
                    </animated.div>
                ))}
            <div
                className="absolute left-0 top-0 flex z-10 p-3 text-shadow">
                {onClose && (
                    <Xmark
                        onClick={() => onClose?.()}
                        color={constants.colors.text.level0}
                        height={30}
                        width={30}
                        className="mr-3"
                    />
                )}
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
                {!readonly && (
                    <Ellipsis
                        height={30}
                        width={30}
                        onClick={() => setShowActionMenu(!showActionMenu)}
                        className='ml-3 text-shadow'
                    />
                )}
                <ItemActionMenu
                    items={[item]}
                    albumId={albumId}
                    isOpen={showActionMenu}
                    onDismiss={() => setShowActionMenu(false)}
                    onDeleteCompletion={() => onClose?.()}
                    position='bottom'
                />
                {isLivePhoto && (
                    <Play
                        onClick={() => setShowLivePhoto(true)}
                        height={30}
                        width={30}
                        className='ml-3 text-shadow'
                    />
                )}
                <InfoCircle
                    height={30}
                    width={30}
                    onClick={() => setShowInfoSheet(true)}
                    className='ml-3 text-shadow'
                />
            </div>
            <SwipeArea {...bind()} />
            <ItemInfoSheet
                item={item}
                isOpen={showInfoSheet}
                onDismiss={() => setShowInfoSheet(false)}
            />
        </Container>
    );
};

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

const SwipeArea = styled.div`
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
`;

export default ItemPreview;


const ItemMedia = ({ item, showLivePhoto, setShowLivePhoto }) => {
    const imageFile = item.files.find(_ => _.contentType.startsWith('image'));
    const videoFile = item.files.find(_ => _.contentType.startsWith('video'));
    const isLivePhoto = !!imageFile && !!videoFile;

    return (
        <>
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
        </>
    );
}
