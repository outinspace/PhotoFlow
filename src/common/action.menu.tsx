import { animated, useTransition } from '@react-spring/web';

interface Option {
    title: string;
    icon: any;
    className?: string;
    onClick: Function;
}

interface Props {
    isOpen: boolean;
    onDismiss: Function;
    onActionStarted?: Function;
    position: 'top' | 'bottom';
    options: Option[];
}

export const ActionMenu = ({ isOpen, onDismiss, onActionStarted, position, options }: Props) => {
    const optionClasses = 'w-full text-left px-4 min-h-12 flex items-center gap-3 text-[15px] border-b border-black/5 last:border-none hover:bg-black/5 active:bg-black/10 cursor-pointer';

    const menuTransitions = useTransition(isOpen, {
        from: {
            y: position === 'top' ? 20 : -20,
            opacity: 0
        },
        enter: {
            y: 0,
            opacity: 1
        },
        leave: {
            y: position === 'top' ? 20 : -20,
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
                    className='glass-panel absolute right-0 overflow-hidden z-20 text-nowrap rounded-2xl min-w-56 my-14'
                    style={{
                        bottom: position === 'top' ? 0 : undefined,
                        top: position === 'bottom' ? 0 : undefined,
                        ...styles
                    }}
                >
                    {options
                        .map(option => (
                            <button
                                type='button'
                                key={option.title}
                                className={`${optionClasses} ${option.className ?? ''}`}
                                onClick={() => {
                                    onActionStarted?.();
                                    option.onClick()
                                }}
                            >
                                <option.icon className='size-5' />
                                {option.title}
                            </button>
                        ))}
                </animated.div>
            ))}
        </>
    )
}
