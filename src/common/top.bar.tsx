import { useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'iconoir-react';
import React, { SVGProps } from 'react';

interface TopBarButton {
    icon: SVGProps; // TODO: 
    className?: string;
    onClick: Function;
}

interface Props {
    title: string;
    rightButtons?: TopBarButton[];
}

export const TopBar = ({ title, rightButtons }: Props) => {
    const { history } = useRouter();

    return (
        <div className='flex justify-center items-center p-3 border-b'>
            <div className='absolute left-3 hover:bg-slate-200 rounded'>
                <ArrowLeft
                    className='size-6 m-1 text-sky-500'
                    onClick={() => history.go(-1)}
                />
            </div>
            <div className='font-bold text-slate-900'>
                {title}
            </div>
            <div className='absolute right-3 hover:bg-slate-200 rounded'>
                {rightButtons?.map(btn => (
                    <btn.icon
                        className={`size-6 m-1 ${btn.className}`}
                        onClick={() => btn.onClick()}
                    />
                ))}
            </div>
        </div>
    );
}
