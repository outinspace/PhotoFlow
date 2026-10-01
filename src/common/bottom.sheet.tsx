import { animated, useSpring, useTransition } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { ReactNode, useEffect } from 'react';
import useMeasure from 'react-use-measure';

interface Props {
    children: ReactNode;
    isOpen: boolean;
    onDismiss: () => any;
}

export const BottomSheet = ({ children, isOpen, onDismiss }: Props) => {
    const [containerRef, bounds] = useMeasure();
    const height = bounds.height ? bounds.height : window.innerHeight;
    const width = bounds.width ? bounds.width : window.innerWidth;

    const placement = width < 768 ? 'bottom' : 'side';

    const [sheetSpring, sheetApi] = useSpring(() => ({
        y: height,
        x: width
    }));

    const shadowTransitions = useTransition(isOpen, {
        from: {
            opacity: 0,
        },
        enter: {
            opacity: 1,
        },
        leave: {
            opacity: 0,
        }
    });


    useEffect(() => {
        sheetApi.start({
            y: placement === 'bottom' ? (isOpen ? 0 : height) : 0,
            x: placement === 'side' ? (isOpen ? 0 : width) : 0,
            config: { tension: 300, clamp: true }
        });
    }, [isOpen, width, height]);

    const dragBindings = useDrag(async ({ down, movement, event }) => {
        event.stopPropagation();

        let [mx, my] = movement;

        // Prevent over dragging
        if (placement === 'bottom') {
            my = Math.max(0, my);
        } else {
            mx = Math.max(0, mx);
        }

        const animateDismiss = (placement === 'bottom' && my > 50) || (placement === 'side' && mx > 50);

        if (!down && animateDismiss) {
            await Promise.all(sheetApi.start({
                y: placement === 'bottom' ? height : 0,
                x: placement === 'side' ? width : 0
            }));
            onDismiss();
        } else if (!down) {
            sheetApi.start({ y: 0, x: 0 });
        } else {
            sheetApi.set({
                y: placement === 'bottom' ? my : 0,
                x: placement === 'side' ? mx : 0
            });
        }
    });

    return (
        <>
            {shadowTransitions((style, openState) => openState && (
                <animated.div
                    className='left-0 right-0 top-0 bottom-0 fixed bg-black/30 z-30'
                    style={style}
                />
            ))}
            {/* The sheet stays mounted when closed and is moved off-screen by a
                transform, so it still spans the viewport and would otherwise swallow
                clicks aimed at whatever is underneath — on the side placement it
                covers the rightmost strip, where map controls live. */}
            <animated.div
                ref={containerRef}
                className={`left-0 right-0 top-0 bottom-0 fixed z-30 max-height-dvh flex flex-col md:flex-row justify-end touch-none ${isOpen ? '' : 'pointer-events-none'}`}
                style={sheetSpring}
                {...dragBindings()}
            >
                <div
                    className='flex-auto min-h-20'
                    onClick={() => onDismiss()}
                >
                </div>
                {/* The sheet covers the tab bar, so nothing inside it needs to clear it. */}
                <div
                    className='glass-panel rounded-t-[28px] md:rounded-[28px] md:m-3 md:w-[50%] lg:w-[33%] max-w-lg overflow-y-auto z-10 flex-initial p-3 pb-9 md:pb-3 flex flex-col [--tabbar-space:0px]'
                >
                    <div aria-hidden className='md:hidden mx-auto mb-1 h-1.5 w-10 flex-none rounded-full bg-slate-400/60' />
                    {children}
                </div>
            </animated.div>
        </>
    );
};

