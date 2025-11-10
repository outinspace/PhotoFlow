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
import { useDrag } from '@use-gesture/react';
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
    const [isAnimating, setIsAnimating] = useState(false);
    const favoriteItem = useFavoriteItem();
    const unfavoriteItem = useUnfavoriteItem();

    const item: Item | undefined = items[itemIndex];

    const [swipeSpring, swipeApi] = useSpring(() => ({ x: 0, y: 0, opacity: 1, scale: 1 }));
    const currentGestureDirection = useRef<'vertical' | 'horizontal'>();

    const dragBindings = useDrag(async ({ down, movement, event, touches }) => {
        event.stopPropagation();

        // Prevent new gestures during animations
        if (isAnimating) {
            return;
        }

        // Check if the page is zoomed in or if it's a pinch gesture
        if (touches > 1) {
            return; // Prevent dragging during pinch gestures
        }
        
        // More reliable zoom detection
        const visualViewport = window.visualViewport;
        if (visualViewport && visualViewport.scale > 1) {
            return; // Prevent dragging if zoomed in
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


        // Smoothly transition between swipe and dismiss
        const dismissPercent = omy / (window.innerHeight / 2);
        const swipePercent = omx / (window.innerWidth / 2);
        const mx = omx * (1 - dismissPercent);
        const my = omy * (1 - swipePercent);

        // Track user drag
        if (down) {
            swipeApi.start({
                x: mx,
                y: my,
                opacity: 1 - Math.abs(my) / window.innerHeight,
                scale: 1 - Math.abs(my) / window.innerHeight,
                immediate: true
            });
            return;
        }

        if (Math.abs(mx) > window.innerWidth / 6) {
            // Snap to next/previous if swiped far enough
            setIsAnimating(true);
            const direction = mx > 0 ? -1 : 1;
            if (direction === -1) {
                await Promise.all(swipeApi.start({
                    x: window.innerWidth,
                    config: { tension: 300, clamp: true }
                }));
                onMovePrevious?.();
            } else {
                await Promise.all(swipeApi.start({
                    x: -window.innerWidth,
                    config: { tension: 300, clamp: true }
                }));
                onMoveNext?.();
            }
            // Reset position
            swipeApi.start({ x: 0, immediate: true });
            setIsAnimating(false);
        } else if (Math.abs(my) > window.innerHeight / 4) {
            // Animate closed
            setIsAnimating(true);
            await Promise.all(swipeApi.start({
                x: 0,
                y: 0,
                opacity: 0,
                scale: 0,
                config: { tension: 300, clamp: true }
            }));

            onClose?.();
            setIsAnimating(false);
        } else {
            // Reset if swipe is canceled
            swipeApi.start({
                x: 0,
                y: 0,
                opacity: 1,
                scale: 1,
                config: { tension: 300, clamp: true }
            });
        }

        // Reset current gesture direction only when gesture ends
        if (!down) {
            currentGestureDirection.current = undefined;
        }
    }, {
        filterTaps: true
    });

    let animateMoveNext: Function;
    let animateMovePrev: Function;

    if (onMoveNext) {
        animateMoveNext = async () => {
            if (isAnimating) return;
            setIsAnimating(true);
            await Promise.all(swipeApi.start({
                x: -window.innerWidth,
                config: { tension: 500, clamp: true }
            }));
            onMoveNext();
            swipeApi.start({ x: 0, immediate: true }); // Reset position
            setIsAnimating(false);
        };
    }

    if (onMovePrevious) {
        animateMovePrev = async () => {
            if (isAnimating) return;
            setIsAnimating(true);
            await Promise.all(swipeApi.start({
                x: window.innerWidth,
                config: { tension: 500, clamp: true }
            }));
            onMovePrevious();
            swipeApi.start({ x: 0, immediate: true }); // Reset position
            setIsAnimating(false);
        };
    }

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
        <Container style={{ opacity: swipeSpring.opacity }}>
            <SwipeArea {...dragBindings()}>
                {[itemIndex - 1, itemIndex, itemIndex + 1]
                    .filter((i) => i >= 0 && i < items.length) // Only render relevant images
                    .map((i) => (
                        <animated.div
                            key={i}
                            className='absolute top-0 bottom-0 left-0 right-0'
                            style={{
                                x: swipeSpring.x.to((val) => {
                                    return (i - itemIndex) * window.innerWidth + val;
                                }),
                                y: swipeSpring.y,
                                scale: swipeSpring.scale
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
                    readonly={!!readonly}
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
    touch-action: manipulation;
`;

export default ItemPreview;
