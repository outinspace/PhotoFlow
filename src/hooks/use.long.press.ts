import React, { useCallback, useRef, useState } from "react";

interface UseLongPressOptions {
    shouldPreventDefault?: boolean;
    delay?: number;
}

const useLongPress = (
    onLongPress: (event: MouseEvent | TouchEvent) => void,
    onClick: () => void,
    { shouldPreventDefault = true, delay = 300 }: UseLongPressOptions = {}
    ) => {
    const [longPressTriggered, setLongPressTriggered] = useState(false);
    const timeout = useRef<number>();
    const target = useRef<EventTarget>();

    const start = useCallback(
        (event: MouseEvent | TouchEvent) => {
            if (shouldPreventDefault && event.target) {
                    event.target.addEventListener("touchend", preventDefault, {
                    passive: false
                });
                target.current = event.target;
            }
            timeout.current = setTimeout(() => {
                onLongPress(event);
                setLongPressTriggered(true);
            }, delay);
        },
        [onLongPress, delay, shouldPreventDefault]
    );

    const clear = useCallback(
        (_event: MouseEvent | TouchEvent, shouldTriggerClick = true) => {
            timeout.current && clearTimeout(timeout.current);
            shouldTriggerClick && !longPressTriggered && onClick();
            setLongPressTriggered(false);
            if (shouldPreventDefault && target.current) {
                target.current.removeEventListener("touchend", preventDefault);
            }
        },
        [shouldPreventDefault, onClick, longPressTriggered]
    );

    return {
        onMouseDown: (e: React.MouseEvent) => start(e.nativeEvent),
        onTouchStart: (e: React.TouchEvent) => start(e.nativeEvent),
        onMouseUp: (e: React.MouseEvent) => clear(e.nativeEvent),
        onMouseLeave: (e: React.MouseEvent) => clear(e.nativeEvent, false),
        onTouchEnd: (e: React.TouchEvent) => clear(e.nativeEvent)
    };
};

const isTouchEvent = (event: Event): event is TouchEvent => {
return "touches" in event;
};

const preventDefault = (event: Event) => {
if (!isTouchEvent(event)) return;

if (event.touches.length < 2 && event.preventDefault) {
    event.preventDefault();
}
};

export default useLongPress;
