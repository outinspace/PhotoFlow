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
                    className='left-0 right-0 top-0 bottom-0 fixed bg-black/50 z-10'
                    style={style}
                />
            ))}
            <animated.div
                ref={containerRef}
                className='left-0 right-0 top-0 bottom-0 fixed z-10 max-height-dvh flex flex-col md:flex-row justify-end touch-none'
                style={sheetSpring}
                {...dragBindings()}
            >
                <div
                    className='flex-auto min-h-20'
                    onClick={() => onDismiss()}
                >
                </div>
                <div
                    className='bg-slate-50 rounded-t-lg md:rounded-none md:rounded-l-lg md:w-[50%] lg:w-[33%] overflow-y-auto z-10 flex-initial p-3 pb-9 md:pb-3 flex flex-col'
                >
                    {children}
                </div>
            </animated.div>
        </>
    );
};

