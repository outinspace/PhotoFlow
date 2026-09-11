import { animated, useTransition } from '@react-spring/web';
import { Check } from 'iconoir-react';

// Shared with the gallery's filter menu so the two cannot drift apart.
export const menuRowClasses = 'border-b last:border-none border-slate-200 px-3 py-3 min-h-11 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 flex items-center gap-2 cursor-pointer';

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
                    className='fixed bg-black/50 top-0 bottom-0 left-0 right-0 z-20'
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
                    className='absolute left-0 top-full mt-1 z-20 w-64 max-h-[60vh] overflow-y-auto rounded-lg drop-shadow text-black'
                    style={styles}
                >
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
                </animated.div>
            ))}
        </>
    );
};
