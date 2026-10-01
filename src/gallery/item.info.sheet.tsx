import { Item } from '../types';
import { Download, MediaImage, MediaVideo, Camera, MapPin, Calendar, Cloud } from 'iconoir-react';
import { formatBytes } from '../common/format.helpers';
import { lazy, Suspense } from 'react';

// Loaded with the map library only when a photo with coordinates is inspected.
const MiniMap = lazy(() => import('../map/mini.map').then(module => ({ default: module.MiniMap })));
import { useNavigate } from '@tanstack/react-router';
import { BottomSheet } from '../common/bottom.sheet';
import { format } from 'date-fns';
import { downloadFile } from '../common/share.helpers';
import { isConfigured } from '../storage/config';

interface Props {
    item: Item;
    isOpen: boolean;
    onDismiss: () => any;
}

const ItemInfoSheet = ({ item, isOpen, onDismiss }: Props) => {
    return (
        <BottomSheet
            isOpen={isOpen}
            onDismiss={onDismiss}
        >
            <div className='flex-auto px-3 pt-2 pb-2 space-y-3'>
                <BasicInfo item={item} />
                <CameraMetadata item={item} />
                <LocationMetadata item={item} />
                <FileMetadata item={item} />
            </div>
        </BottomSheet>
    );
};

const BasicInfo = ({ item }: { item: Item }) => {
    return (
        <div className='rounded-2xl bg-white/70 p-4'>
            <div className='flex items-center gap-2'>
                <Calendar className='size-5 text-slate-500' />
                <span className='text-[17px] font-semibold'>
                    {format(new Date(item.captureTime), 'MMMM d, yyyy')} at {format(new Date(item.captureTime), 'h:mm a')}
                </span>
            </div>
            <div className='mt-1 pl-7 text-sm text-slate-600'>
                Uploaded {format(new Date(item.primaryFile.uploadTimeUtc), 'MMMM d, yyyy')} at {format(new Date(item.primaryFile.uploadTimeUtc), 'h:mm a')}
            </div>
        </div>
    );
};

const CameraMetadata = ({ item }: { item: Item }) => {
    if (!item.cameraMake && !item.cameraModel) return null;

    const dataPoints = [
        item.widthPixels && item.heightPixels ? `${item.widthPixels} × ${item.heightPixels}` : null,
        item.megapixels ? `${item.megapixels.toFixed(1)} MP` : null,
        item.fNumber ? `f/${item.fNumber}` : null,
        // item.exposureTime ? `${item.exposureTime}s` : null, BUG: API is parsing "/"
        item.iso ? `ISO ${item.iso}` : null,
        item.videoLength ? `${item.videoLength}s` : null
    ].filter(Boolean);

    return (
        <div className='rounded-2xl bg-white/70 p-4'>
            <div className='flex items-center gap-2 mb-2'>
                <Camera className='size-5 text-slate-500' />
                <span className='font-medium'>Camera</span>
            </div>
            <div className='text-sm text-slate-600 mb-1'>
                {item.cameraMake} {item.cameraModel}
            </div>
            {dataPoints.length > 0 && (
                <div className='text-sm text-slate-600'>
                    {dataPoints.join(' · ')}
                </div>
            )}
        </div>
    );
};

const LocationMetadata = ({ item }: { item: Item }) => {
    const navigate = useNavigate();
    const positionAvailable = item.latitude && item.longitude;

    if (!positionAvailable) return null;

    // The full map is the owner's library view and needs a connection. Someone
    // opening a share link has none, so for them the map is a picture, not a link.
    const canOpenMap = isConfigured();

    const navigateToMap = () => canOpenMap && navigate({
        to: '/map',
        search: {
            latitude: item.latitude,
            longitude: item.longitude
        }
    });

    return (
        <div className='rounded-2xl bg-white/70 p-4'>
            <div className='flex items-center gap-2 mb-2'>
                <MapPin className='size-5 text-slate-500' />
                <span className='font-medium'>Location</span>
            </div>
            <div className='text-sm text-slate-600 mb-2'>
                {item.city && item.region ? `${item.city}, ${item.region}` : 'Unknown location'}
                {item.altitude && ` (${Math.round(item.altitude)}m)`}
            </div>
            <div className={`h-44 overflow-hidden rounded-xl ${canOpenMap ? 'cursor-pointer' : ''}`} onClick={navigateToMap}>
                <Suspense fallback={<div className='size-full bg-slate-100' />}>
                    <MiniMap latitude={item.latitude!} longitude={item.longitude!} />
                </Suspense>
            </div>
        </div>
    );
};

const FileMetadata = ({ item }: { item: Item }) => {
    return (
        <div className='rounded-2xl bg-white/70 p-4'>
            <div className='flex items-center gap-2 mb-2'>
                <Cloud className='size-5 text-slate-500' />
                <span className='font-medium'>Files</span>
            </div>
            <div className='space-y-2'>
                {item.files.map(file => (
                    <div key={file.fileId} className='flex items-center gap-1 rounded-xl bg-slate-100'>
                        <div className='pl-3 flex-none text-slate-500'>
                            {file.contentType.startsWith('image') ? (
                                <MediaImage className='size-5' />
                            ) : (
                                <MediaVideo className='size-5' />
                            )}
                        </div>
                        <div className='flex-auto min-w-0 p-2 truncate text-[15px]'>
                            {file.originalFileName}
                        </div>
                        <div className='p-2 flex-none text-sm text-slate-500'>
                            {formatBytes(file.sizeBytes)}
                        </div>
                        <button
                            type='button'
                            onClick={() => downloadFile(file)}
                            className='flex size-10 flex-none items-center justify-center rounded-full hover:bg-black/5 cursor-pointer'
                            title='Download'
                            aria-label={`Download ${file.originalFileName}`}
                        >
                            <Download className='size-5' />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};


export default ItemInfoSheet;
