import { ZoomIn, ZoomOut } from 'iconoir-react';

interface Props {
    onZoomIn: () => void;
    onZoomOut: () => void;
    zoomInDisabled: boolean;
    zoomOutDisabled: boolean;
}

export const ZoomButtons = ({ onZoomIn, onZoomOut, zoomInDisabled, zoomOutDisabled }: Props) => {

    return (
        <div className='flex rounded-full overflow-hidden border border-white/20 shadow-lg'>
            <button
                className='p-3 backdrop-blur-2xl bg-white/60 hover:bg-white/50 active:bg-white/50 cursor-pointer disabled:opacity-40 disabled:cursor-default'
                onClick={() => onZoomIn()}
                disabled={zoomInDisabled}
                title='Zoom in'
                aria-label='Zoom in'
            >
                <ZoomIn
                    className='size-6 text-black drop-shadow-sm'
                />
            </button>
            <div className='w-px bg-white/20' />
            <button
                className='p-3 backdrop-blur-2xl bg-white/60 hover:bg-white/50 active:bg-white/50 cursor-pointer disabled:opacity-40 disabled:cursor-default'
                onClick={() => onZoomOut()}
                disabled={zoomOutDisabled}
                title='Zoom out'
                aria-label='Zoom out'
            >
                <ZoomOut
                    className='size-6 text-black drop-shadow-sm'
                />
            </button>
        </div>
    );
};
