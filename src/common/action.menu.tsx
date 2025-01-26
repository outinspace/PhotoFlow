import { animated, useTransition } from '@react-spring/web';
import React from 'react';

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
    const optionClasses = 'border-b last:border-none border-slate-200 p-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 first:rounded-t last:rounded-b flex items-center';

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
                    className='absolute right-0 overflow-none z-20 text-nowrap text-black drop-shadow min-w-40 my-12'
                    style={{
                        bottom: position === 'top' ? 0 : undefined,
                        top: position === 'bottom' ? 0 : undefined,
                        ...styles
                    }}
                >
                    {options
                        .map(option => (
                            <div
                                key={option.title}
                                className={`${optionClasses} ${option.className}`}
                                onClick={() => {
                                    onActionStarted?.();
                                    option.onClick()
                                }}
                            >
                                <option.icon className='size-5 ml-1 mr-2' />
                                {option.title}
                            </div>
                        ))}
                </animated.div>
            ))}
        </>
    )
}
