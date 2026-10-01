import { ReactNode } from 'react';
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
                return 'bg-black/5 text-slate-700 hover:bg-black/10 active:bg-black/15';
            case 'primary':
                return 'bg-sky-600 text-white hover:bg-sky-500 active:bg-sky-700';
            case 'destructive':
                return 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700';
        }
    };

    return <>
        {createPortal(
            <>
                {shadowTransitions((styles, state) => state && (
                    <animated.div
                        className='fixed flex z-40 top-0 bottom-0 left-0 right-0 bg-black/30'
                        style={styles}
                    />
                ))}
                {modalTransitions((styles, state) => state && (
                    <animated.div
                        className='z-40 fixed flex top-0 bottom-0 left-0 right-0 justify-center items-center'
                        style={styles}
                    >
                        <div className='glass-panel flex-col rounded-[28px] p-6 m-6 w-full max-w-sm'>
                            <div className='text-center text-lg font-semibold text-slate-900 mb-1.5'>{title}</div>
                            <div className='text-center text-[15px] text-slate-600 mb-5'>
                                {description}
                            </div>
                            {children && (
                                <div className='flex mb-5'>
                                    {children}
                                </div>
                            )}
                            <div className='flex gap-2'>
                                {actions.map(action => (
                                    <button
                                        key={action.text}
                                        className={`flex-1 h-11 rounded-full text-[15px] font-semibold cursor-pointer disabled:opacity-40 ${getButtonColorClasses(action)}`}
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
            document.getElementById('modal-root')!
        )}
    </>;
}
