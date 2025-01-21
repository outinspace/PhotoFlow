import React from 'react';

interface Option {
    title: string;
    icon: any;
    className?: string;
    onClick: Function;
}

interface Props {
    onDismiss: Function;
    onActionStarted?: Function;
    position: 'top' | 'bottom';
    options: Option[];
}

export const ActionMenu = ({ onDismiss, onActionStarted, position, options }: Props) => {

    const optionClasses = 'border-b last:border-none border-slate-200 p-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 first:rounded-t last:rounded-b flex items-center';

    return (
        <>
            <div
                className='fixed bg-black/50 top-0 bottom-0 left-0 right-0 z-20'
                style={{ width: '10000px', height: '10000px', marginLeft: '-5000px', marginTop: '-5000px' }}
                onClick={() => onDismiss()}
            />
            <div
                className={`absolute text-nowrap min-w-40 right-0 text-black mr-2 drop-shadow my-12 z-20`}
                style={{
                    bottom: position === 'top' ? 0 : undefined,
                    top: position === 'bottom' ? 0 : undefined
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
            </div>
        </>
    )
}
