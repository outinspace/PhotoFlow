import { useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'iconoir-react';
import React, { ReactNode } from 'react';

interface TopBarButton {
    icon: any;
    className?: string;
    onClick: Function;
    children?: ReactNode;
}

interface Props {
    title: string;
    rightButtons?: TopBarButton[];
    onTitleClick?: Function;
    hideBack?: boolean;
}

export const TopBar = ({ title, rightButtons, onTitleClick, hideBack }: Props) => {
    const { history } = useRouter();

    return (
        <div className='flex justify-center items-center p-3 border-b border-slate-200'>
            {!hideBack && (
                <div className='absolute left-3 hover:bg-slate-200 rounded p-1'>
                    <ArrowLeft
                        className='size-6 text-sky-500'
                        onClick={() => history.go(-1)}
                    />
                </div>
            )}
            <div
                className='font-bold text-slate-900 truncate text-ellipsis'
                style={{ maxWidth: '50%' }}
                onClick={() => onTitleClick?.()}
            >
                {title}
            </div>
            <div className='flex absolute right-3'>
                {rightButtons?.map((btn, i) => (
                    <div key={i} className='ml-2 p-1 hover:bg-slate-200 rounded text-slate-500'>
                        <btn.icon
                            className={`size-6 ${btn.className}`}
                            onClick={() => btn.onClick()}
                        />
                        {btn.children}
                    </div>
                ))}
            </div>
        </div>
    );
}
