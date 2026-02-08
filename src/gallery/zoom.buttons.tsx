import { ZoomIn, ZoomOut } from 'iconoir-react';

interface Props {
    onZoomIn: Function;
    onZoomOut: Function;
}

export const ZoomButtons = ({ onZoomIn, onZoomOut }: Props) => {

    return (
        <div className='flex rounded-full overflow-hidden border border-white/20 shadow-lg'>
            <div
                className='p-3 backdrop-blur-2xl bg-white/60 hover:bg-white/50 active:bg-white/50 cursor-pointer'
                onClick={() => onZoomIn()}
            >
                <ZoomIn
                    className='size-6 text-black drop-shadow-sm'
                />
            </div>
            <div className='w-px bg-white/20' />
            <div
                className='p-3 backdrop-blur-2xl bg-white/60 hover:bg-white/50 active:bg-white/50 cursor-pointer'
                onClick={() => onZoomOut()}
            >
                <ZoomOut
                    className='size-6 text-black drop-shadow-sm'
                />
            </div>
        </div>
    );
};
