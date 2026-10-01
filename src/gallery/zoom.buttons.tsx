import { ZoomIn, ZoomOut } from 'iconoir-react';

interface Props {
    onZoomIn: () => void;
    onZoomOut: () => void;
    zoomInDisabled: boolean;
    zoomOutDisabled: boolean;
}

export const ZoomButtons = ({ onZoomIn, onZoomOut, zoomInDisabled, zoomOutDisabled }: Props) => {

    return (
        <div className='glass flex h-11 rounded-full overflow-hidden'>
            <button
                className='px-3 hover:bg-white/60 active:bg-white cursor-pointer disabled:opacity-40 disabled:cursor-default'
                onClick={() => onZoomIn()}
                disabled={zoomInDisabled}
                title='Zoom in'
                aria-label='Zoom in'
            >
                <ZoomIn
                    className='size-5'
                />
            </button>
            <div className='w-px my-2.5 bg-black/10' />
            <button
                className='px-3 hover:bg-white/60 active:bg-white cursor-pointer disabled:opacity-40 disabled:cursor-default'
                onClick={() => onZoomOut()}
                disabled={zoomOutDisabled}
                title='Zoom out'
                aria-label='Zoom out'
            >
                <ZoomOut
                    className='size-5'
                />
            </button>
        </div>
    );
};
