import { Item } from '../types';
import { Download, MediaImage, MediaVideo, Camera, MapPin, Calendar, Cloud } from 'iconoir-react';
import { LatLngExpression } from 'leaflet';
import { formatBytes } from '../common/format.helpers';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { useNavigate } from '@tanstack/react-router';
import { BottomSheet } from '../common/bottom.sheet';
import { format } from 'date-fns';
import { downloadFile } from '../common/share.helpers';

interface Props {
    item: Item;
    isOpen: boolean;
    onDismiss: () => any;
    tenantId?: string;
}

const ItemInfoSheet = ({ item, isOpen, onDismiss, tenantId }: Props) => {
    return (
        <BottomSheet
            isOpen={isOpen}
            onDismiss={onDismiss}
        >
            <div className='flex-auto p-4'>
                <BasicInfo item={item} />
                <CameraMetadata item={item} />
                <LocationMetadata item={item} />
                <FileMetadata item={item} tenantId={tenantId} />
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

    const position: LatLngExpression = [item.latitude ?? 0, item.longitude ?? 0];

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
            <div className='border border-slate-200 h-48 overflow-hidden rounded' onClick={navigateToMap}>
                <MapContainer center={position} zoom={13} scrollWheelZoom={false} zoomControl={false} className='select-none' dragging={false} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={position} />
                </MapContainer>
            </div>
        </div>
    );
};

const FileMetadata = ({ item, tenantId }: { item: Item, tenantId?: string }) => {
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
                            <Download onClick={() => downloadFile(file.fileId, tenantId)} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


export default ItemInfoSheet;
