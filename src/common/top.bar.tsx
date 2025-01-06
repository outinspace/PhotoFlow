import { useRouter } from '@tanstack/react-router';
import { NavArrowLeft } from 'iconoir-react';
import React from 'react';

export const TopBar = ({ title }) => {
    const { history } = useRouter();

    return (
        <div className='flex justify-center items-center p-3 border-b'>
            <div className='absolute left-3 hover:bg-slate-200 rounded'>
                <NavArrowLeft
                    className='size-8 text-sky-500'
                    onClick={() => history.go(-1)}
                />
            </div>
            <div className='font-bold text-slate-900'>
                {title}
            </div>
        </div>
    );
}
