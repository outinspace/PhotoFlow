import React, { ReactNode } from 'react';

interface Props {
    children: ReactNode;
    isOpen: boolean;
    onDismiss: () => any;
}

export const BottomSheet = ({ children, isOpen, onDismiss }: Props) => {
    // TODO: Escape keybinding

    if (!isOpen) {
        return;
    }

    return (
        <div
            className='left-0 right-0 top-0 bottom-0 fixed bg-slate-900/60 z-10 max-height-dvh bordered flex flex-col md:flex-row justify-end'
        >
            <div
                className='flex-auto min-h-20'
                onClick={() => onDismiss()}
            >
            </div>
            <div
                className='bg-slate-50 rounded-t-lg md:rounded-none md:rounded-l-lg md:min-w-96 overflow-y-auto z-10 flex-initial p-3 pb-9 md:pb-3 flex'
            >
                {children}
            </div>
        </div>
    );
};

