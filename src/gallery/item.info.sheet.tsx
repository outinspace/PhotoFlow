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
            <div className='flex-auto p-4'>
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
        <div className='mb-6'>
            <div className='flex items-center gap-2'>
                <Calendar className='size-5' />
                <span className='font-medium'>
                    {format(new Date(item.captureTime), 'MMMM d, yyyy')} at {format(new Date(item.captureTime), 'h:mm a')}
                </span>
            </div>
            <div className='mt-1 text-sm text-slate-600'>
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
        <div className='mb-6'>
            <div className='flex items-center gap-2 mb-2'>
                <Camera className='size-5' />
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

    const navigateToMap = () => navigate({
        to: '/map',
        search: {
            latitude: item.latitude,
            longitude: item.longitude
        }
    });

    return (
        <div className='mb-6'>
            <div className='flex items-center gap-2 mb-2'>
                <MapPin className='size-5' />
                <span className='font-medium'>Location</span>
            </div>
            <div className='text-sm text-slate-600 mb-2'>
                {item.city && item.region ? `${item.city}, ${item.region}` : 'Unknown location'}
                {item.altitude && ` (${Math.round(item.altitude)}m)`}
            </div>
            <div className='h-48 cursor-pointer overflow-hidden rounded border border-slate-200' onClick={navigateToMap}>
                <Suspense fallback={<div className='size-full bg-slate-100' />}>
                    <MiniMap latitude={item.latitude!} longitude={item.longitude!} />
                </Suspense>
            </div>
        </div>
    );
};

const FileMetadata = ({ item }: { item: Item }) => {
    return (
        <div>
            <div className='flex items-center gap-2 mb-2'>
                <Cloud className='size-5' />
                <span className='font-medium'>Files</span>
            </div>
            <div className='space-y-2'>
                {item.files.map(file => (
                    <div key={file.fileId} className='flex items-center bg-slate-100 rounded'>
                        <div className='p-2 flex-none'>
                            {file.contentType.startsWith('image') ? (
                                <MediaImage className='size-5' />
                            ) : (
                                <MediaVideo className='size-5' />
                            )}
                        </div>
                        <div className='border-l border-slate-200 flex-auto p-2 truncate text-ellipsis'>
                            {file.originalFileName}
                        </div>
                        <div className='border-l border-slate-200 p-2 flex-none text-sm text-slate-600'>
                            {formatBytes(file.sizeBytes)}
                        </div>
                        <div className='border-l border-slate-200 p-2 flex-none hover:bg-slate-200 rounded-r'>
                            <Download onClick={() => downloadFile(file)} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


export default ItemInfoSheet;
