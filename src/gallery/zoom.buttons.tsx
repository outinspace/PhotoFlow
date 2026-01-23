import { ZoomIn, ZoomOut } from 'iconoir-react';

interface Props {
    onZoomIn: Function;
    onZoomOut: Function;
}

export const ZoomButtons = ({ onZoomIn, onZoomOut }: Props) => {

    return (
        <div className='flex rounded-full overflow-hidden backdrop-blur-2xl bg-white/10 border border-white/20 shadow-lg transition-all duration-200'>
            <div
                className='p-3 hover:bg-white/20 active:bg-white/30 transition-colors duration-150 cursor-pointer'
                onClick={() => onZoomIn()}
            >
                <ZoomIn
                    className='size-6 text-white drop-shadow-sm'
                />
            </div>
            <div className='w-px bg-white/20' />
            <div
                className='p-3 hover:bg-white/20 active:bg-white/30 transition-colors duration-150 cursor-pointer'
                onClick={() => onZoomOut()}
            >
                <ZoomOut
                    className='size-6 text-white drop-shadow-sm'
                />
            </div>
        </div>
    );
};
