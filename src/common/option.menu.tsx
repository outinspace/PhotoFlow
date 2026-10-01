import { animated, useTransition } from '@react-spring/web';
import { Check } from 'iconoir-react';

// Shared with the gallery's filter menu so the two cannot drift apart.
export const menuRowClasses = 'px-4 min-h-12 flex items-center gap-3 text-[15px] border-b border-black/5 last:border-none hover:bg-black/5 active:bg-black/10 cursor-pointer';

export interface MenuOption {
    value: string;
    label: string;
}

interface Props {
    isOpen: boolean;
    onDismiss: () => any;
    options: MenuOption[];
    value: string;
    onSelect: (value: string) => any;
}

// A single-choice menu that drops from its trigger, with the current value
// checked — the flat case of the gallery's filter menu, for the places that were
// reaching for a native select. The trigger supplies the positioning context, so
// wrap it in something relatively positioned.
export const OptionMenu = ({ isOpen, onDismiss, options, value, onSelect }: Props) => {
    const menuTransitions = useTransition(isOpen, {
        from: {
            y: -20,
            opacity: 0
        },
        enter: {
            y: 0,
            opacity: 1
        },
        leave: {
            y: -20,
            opacity: 0
        },
        config: { tension: 500 }
    });

    const shadowTransitions = useTransition(isOpen, {
        from: {
            opacity: 0
        },
        enter: {
            opacity: 1
        },
        leave: {
            opacity: 0
        },
        config: { tension: 500 }
    });

    return (
        <>
            {shadowTransitions((styles, state) => state && (
                <animated.div
                    className='fixed bg-black/20 top-0 bottom-0 left-0 right-0 z-20'
                    style={{
                        width: '10000px',
                        height: '10000px',
                        marginLeft: '-5000px',
                        marginTop: '-5000px',
                        ...styles
                    }}
                    onClick={() => onDismiss()}
                />
            ))}
            {menuTransitions((styles, state) => state && (
                <animated.div
                    className='glass-panel absolute left-0 top-full mt-2 z-20 w-64 max-h-[60vh] flex flex-col overflow-hidden rounded-2xl'
                    style={styles}
                >
                    {/* The shell animates and casts the shadow, a plain box inside it
                        scrolls. A filter on a scrolling box stops the browser
                        repainting rows as they scroll into view. */}
                    <div className='flex-auto min-h-0 overflow-y-auto overscroll-contain touch-pan-y'>
                        {options.map(option => (
                            <div
                                key={option.value}
                                className={menuRowClasses}
                                onClick={() => {
                                    onSelect(option.value);
                                    onDismiss();
                                }}
                            >
                                <span className='flex-auto'>{option.label}</span>
                                {value === option.value && (
                                    <Check className='size-5 text-sky-600' />
                                )}
                            </div>
                        ))}
                    </div>
                </animated.div>
            ))}
        </>
    );
};
