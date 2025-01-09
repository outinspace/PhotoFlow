import React from 'react';
import { ZoomIn, ZoomOut } from 'iconoir-react';

interface Props {
    onZoomIn: Function;
    onZoomOut: Function;
}

export const ZoomButtons = ({ onZoomIn, onZoomOut }: Props) => {

    return (
        <div className='flex absolute bottom-2 left-2 bg-slate-100 rounded drop-shadow overflow-hidden'>
            <div
                className='p-2 hover:bg-slate-200 active:bg-slate-300'
                onClick={() => onZoomIn()}
            >
                <ZoomIn
                    className='size-6'
                />
            </div>
            <div
                className='p-2 hover:bg-slate-200 active:bg-slate-300'
                onClick={() => onZoomOut()}
            >
                <ZoomOut
                    className='size-6'
                />
            </div>
        </div>
    );
};
