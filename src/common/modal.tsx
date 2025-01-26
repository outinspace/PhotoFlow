import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { animated, useTransition } from '@react-spring/web';

interface ModalAction {
    text: string;
    color: 'destructive' | 'neutral' | 'primary'
    onClick: Function;
    disabled?: boolean;
}

interface Props {
    isOpen: boolean;
    title: string;
    description: string;
    children?: ReactNode;
    actions: ModalAction[];
}

export const Modal = ({ isOpen, title, description, children, actions }: Props) => {
    const modalTransitions = useTransition(isOpen, {
        from: {
            opacity: 0,
            scale: 0.75
        },
        enter: {
            opacity: 1,
            scale: 1
        },
        leave: {
            opacity: 0,
            scale: 0.75
        },
        config: { tension: 500 }
    });

    const shadowTransitions = useTransition(isOpen, {
        from: {
            opacity: 0,
        },
        enter: {
            opacity: 1,
        },
        leave: {
            opacity: 0,
        },
        config: { tension: 500 }
    });

    // TODO: Handle disabled color
    const getButtonColorClasses = (action: ModalAction) => {
        switch (action.color) {
            case 'neutral':
                return 'bg-slate-100 text-slate-500 hover:bg-slate-200 active:bg-slate-300';
            case 'primary':
                return 'bg-sky-100 text-sky-500 hover:bg-sky-200 active:bg-sky-300';
            case 'destructive':
                return 'bg-red-100 text-red-500 hover:bg-red-200 active:bg-red-300';
        }
    };

    return <>
        {createPortal(
            <>
                {shadowTransitions((styles, state) => state && (
                    <animated.div
                        className='fixed flex z-10 top-0 bottom-0 left-0 right-0 bg-black/50'
                        style={styles}
                    />
                ))}
                {modalTransitions((styles, state) => state && (
                    <animated.div
                        className='z-10 fixed flex top-0 bottom-0 left-0 right-0 justify-center items-center drop-shadow'
                        style={styles}
                    >
                        <div className='flex-col bg-slate-50 rounded text-black p-6 m-10 max-w-80'>
                            <div className='flex justify-center font-bold text-slate-900 mb-2'>{title}</div>
                            <div className='text-slate-600 mb-5'>
                                {description}
                            </div>
                            {children && (
                                <div className='flex mb-5'>
                                    {children}
                                </div>
                            )}
                            <div className='flex justify-between'>
                                {actions.map(action => (
                                    <button
                                        key={action.text}
                                        className={`rounded p-2 mr-3 last:mr-0 ${getButtonColorClasses(action)}`}
                                        onClick={() => action.onClick()}
                                        disabled={action.disabled}
                                    >
                                        {action.text}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </animated.div>

                ))}
            </>,
            document.getElementById('modal-root')
        )}
    </>;
}
