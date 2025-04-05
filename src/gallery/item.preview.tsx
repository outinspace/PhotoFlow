import React, { useRef, useState } from 'react';
import { Item } from '../types';
import styled from '@emotion/styled';
import { InfoCircle, Star, StarSolid, Xmark } from 'iconoir-react';
import constants from '../design.constants';
import { useKeyBindings } from '../hooks/use.key.bindings';
import ItemInfoSheet from './item.info.sheet';
import { differenceInDays, format } from 'date-fns';
import { ItemActionMenu } from './item.action.menu';
import { Ellipsis } from '../common/ellipsis';
import { animated, useSpring } from '@react-spring/web';
import { useDrag, useGesture, usePinch } from '@use-gesture/react';
import ItemMedia from './item.media';
import { useFavoriteItem, useUnfavoriteItem } from '../queries';

interface Props {
    items: Item[];
    itemIndex: number;
    albumId: number | null,
    onMoveNext?: Function;
    onMovePrevious?: Function;
    onClose?: Function;
    readonly?: boolean;
}

const ItemPreview = ({ items, itemIndex, albumId, onMovePrevious, onMoveNext, onClose, readonly }: Props) => {
    const [showInfoSheet, setShowInfoSheet] = useState(false);
    const [showActionMenu, setShowActionMenu] = useState(false);
    const favoriteItem = useFavoriteItem();
    const unfavoriteItem = useUnfavoriteItem();

    const item: Item | undefined = items[itemIndex];

    const [spring, springApi] = useSpring(() => ({
        x: 0,
        y: 0,
        opacity: 1,
        scale: 1
    }));

    const currentGestureDirection = useRef<'vertical' | 'horizontal'>();
    const scaleRef = useRef(1);
    const ref = useRef<HTMLDivElement>(null);

    useGesture({
        onDrag: async ({ pinching, cancel, movement, event, touches }) => {   
            // event.stopPropagation();

            if (pinching) {
                cancel();
            }

            
        },
        onPinch: async ({ first, origin: [ox, oy], movement: [ms], offset: [s, a], memo }) => {
            // event.stopPropagation();

            console.log({ms})
            if (first) {
                const { width, height, x, y } = ref.current!.getBoundingClientRect()
                const tx = ox - (x + width / 2)
                const ty = oy - (y + height / 2)
                memo = [spring.x.get(), spring.y.get(), tx, ty]
            }
      
            const x = memo[0] - (ms - 1) * memo[2]
            const y = memo[1] - (ms - 1) * memo[3]
            springApi.start({
                scale: s,
                x,
                y
            });
            return memo;
        }
    },
    {
        target: ref,
        drag: { from: () => [spring.x.get(), spring.y.get()] },
        pinch: { scaleBounds: { min: 1, max: 2 }, rubberband: true },
    });

    const dragBindings = useDrag(async ({ down, movement, event, touches }) => {
        event.stopPropagation();

        // // Handle pinch zoom
        // if (touches === 2) {
        //     const distance = Math.sqrt(movement[0] ** 2 + movement[1] ** 2);
        //     const newScale = (1 + distance / window.innerWidth);
        //     scaleRef.current = newScale;
        //     swipeApi.start({
        //         scale: newScale,
        //         immediate: true
        //     });
        //     return;
        // }

        // Don't allow swiping if the scale is less than 1
        if (scaleRef.current !== 1) {
            return;
        }

        let [omx, omy] = movement;

        if (!currentGestureDirection.current) {
            if (Math.abs(omy) > 10) {
                currentGestureDirection.current = 'vertical';
            } else if (Math.abs(omx) > 10) {
                currentGestureDirection.current = 'horizontal';
            }
        }

        if (currentGestureDirection.current === 'vertical') {
            omx = 0;
        }

        if (currentGestureDirection.current === 'horizontal') {
            omy = 0;
        }

        if (touches > 1) {
            return;
        }

        const dismissPercent = omy / (window.innerHeight / 2);
        const swipePercent = omx / (window.innerWidth / 2);
        const mx = omx * (1 - dismissPercent);
        const my = omy * (1 - swipePercent);

        if (down) {
            springApi.start({
                x: mx,
                y: my,
                opacity: 1 - Math.abs(my) / window.innerHeight,
                scale: scaleRef.current,
                immediate: false
            });
            return;
        }

        if (Math.abs(mx) > window.innerWidth / 6) {
            // Snap to next/previous if swiped far enough
            const direction = mx > 0 ? -1 : 1;
            if (direction === -1) {
                await Promise.all(springApi.start({
                    x: window.innerWidth,
                    scale: 1,
                    config: { tension: 300, clamp: true }
                }));
                onMovePrevious?.();
            } else {
                await Promise.all(springApi.start({
                    x: -window.innerWidth,
                    scale: 1,
                    config: { tension: 300, clamp: true }
                }));
                onMoveNext?.();
            }
            // Reset position
            springApi.start({ x: 0, immediate: true });

            // Reset scale
            scaleRef.current = 1;
        } else if (Math.abs(my) > window.innerHeight / 4) {
            await Promise.all(springApi.start({
                x: 0,
                y: 0,
                opacity: 0,
                scale: 0,
                config: { tension: 300, clamp: true }
            }));

            onClose?.();
        } else {
            // Reset if swipe is canceled
            springApi.start({
                x: 0,
                y: 0,
                opacity: 1,
                scale: scaleRef.current,
                config: { tension: 300, clamp: true }
            });
        }

        // Reset current gesture direction
        currentGestureDirection.current = undefined;
    }, {
        filterTaps: true
    });

    let animateMoveNext: Function;
    let animateMovePrev: Function;

    if (onMoveNext) {
        animateMoveNext = async () => {
            await Promise.all(springApi.start({
                x: -window.innerWidth,
                config: { tension: 500, clamp: true }
            }));
            onMoveNext();
            springApi.start({ x: 0, immediate: true }); // Reset position
        };
    }

    if (onMovePrevious) {
        animateMovePrev = async () => {
            await Promise.all(springApi.start({
                x: window.innerWidth,
                config: { tension: 500, clamp: true }
            }));
            onMovePrevious();
            springApi.start({ x: 0, immediate: true }); // Reset position
        };
    }

    // const pinchBindings = usePinch(async ({ movement, event, touches }) => {
    //     event.stopPropagation();

    //     if (touches === 2) {
    //         const distance = Math.sqrt(movement[0] ** 2 + movement[1] ** 2);
    //         const newScale = (1 + distance / window.innerWidth);
    //         scaleRef.current = newScale;
    //         springApi.start({
    //             scale: newScale,
    //             immediate: true
    //         });
    //     }
    // });

    useKeyBindings([
        { cmd: ['ArrowLeft'], callback: () => animateMovePrev?.() },
        { cmd: ['ArrowRight'], callback: () => animateMoveNext?.() },
        { cmd: ['Escape'], callback: () => onClose?.() }
    ], [onMovePrevious, onMoveNext, onClose]);

    if (!item) {
        return;
    }

    const heading = formatRelativeOrLongDateTime(item.captureTime);
    const subheading = [
        item.type === 'live-photo' ? 'Live' : null,
        item.city && item.region ? `${item.city}, ${item.region}` : null
    ]
        .filter(_ => !!_)
        .join(' • ');


    return (
        <Container style={{ opacity: spring.opacity }}>
            <SwipeArea ref={ref}>
                {[itemIndex - 1, itemIndex, itemIndex + 1]
                    .filter((i) => i >= 0 && i < items.length) // Only render relevant images
                    .map((i) => (
                        <animated.div
                            key={i}
                            className='absolute top-0 bottom-0 left-0 right-0'
                            style={{
                                x: spring.x.to((val) => {
                                    return (i - itemIndex) * window.innerWidth + val;
                                }),
                                y: spring.y,
                                scale: i === itemIndex ? spring.scale : 1
                            }}
                        >
                            <ItemMedia
                                isPrimary={i === itemIndex}
                                item={items[i]}
                            />
                        </animated.div>
                    ))}
            </SwipeArea>
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
                <InfoCircle
                    height={30}
                    width={30}
                    onClick={() => setShowInfoSheet(true)}
                    className='ml-3 text-shadow'
                />
                {!readonly && !item.isFavorite && (
                    <Star
                        height={30}
                        width={30}
                        onClick={() => favoriteItem.mutateAsync(item.itemId)}
                        className='ml-3 text-shadow'
                    />
                )}
                {!readonly && item.isFavorite && (
                    <StarSolid
                        height={30}
                        width={30}
                        onClick={() => unfavoriteItem.mutateAsync(item.itemId)}
                        className='ml-3 text-shadow'
                    />
                )}
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
            </div>
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

const Container = styled(animated.div)`
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
    touch-action: none;
`;

export default ItemPreview;
