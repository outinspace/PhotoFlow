import React from 'react';
import { Item } from '../types';
import { Download, MediaImage, MediaVideo } from 'iconoir-react';
import { Icon, LatLngExpression } from 'leaflet';
import { formatBytes } from '../common/format.helpers';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { useNavigate } from '@tanstack/react-router';
import { BottomSheet } from '../common/bottom.sheet';

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
            <div className='flex-auto'>
                <CameraMetadata item={item} />
                <FileMetadata item={item} />
                <LocationMetadata item={item} />
            </div>
        </BottomSheet>
    );
};

const CameraMetadata = ({ item }: { item: Item }) => {
    const dataPoints = [
        `${item.widthPixels} x ${item.heightPixels}`,
        `${item.cameraMake} ${item.cameraModel}`
    ];

    const combinedDataPoints = dataPoints.join(' · ')

    return (
        <div className=''>
            <div className=''>
                Camera
            </div>
            <div>
                {combinedDataPoints}
            </div>
        </div>
    );
};

const FileMetadata = ({ item }: { item: Item }) => {

    return (
        <div className='mt-5'>
            <div className=''>
                Files
            </div>
            <div>
                {item.files.map(file => (
                    <div key={file.fileId} className='flex items-center mb-1 bg-slate-100 rounded'>
                        <div className='p-2 flex-none'>
                            {file.contentType.startsWith('image') ? (
                                <MediaImage className='size-6' />
                            ) : (
                                <MediaVideo className='size-6' />
                            )}
                        </div>
                        <div className='border-l border-slate-50 flex-auto p-2 truncate text-ellipsis'>
                            {file.originalFileName}
                        </div>
                        <div className='border-l border-slate-50 p-2 flex-none'>
                            {formatBytes(file.sizeBytes)}
                        </div>
                        <div className='border-l border-slate-50 p-2 flex-none hover:bg-slate-200 rounded-r'>
                            <Download onClick={() => downloadfile(file.originalUrl, file.originalFileName)} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

async function downloadfile(uri: string, name: string) {
    var link = document.createElement("a");
    link.download = name;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

const LocationMetadata = ({ item }: { item: Item }) => {
    const navigate = useNavigate();
    const positionAvailable = item.latitude && item.longitude;

    if (!positionAvailable || !item.primaryFile.tileImageUrl) {
        return;
    }

    const position: LatLngExpression = [item.latitude ?? 0, item.longitude ?? 0];

    const markerIcon = new Icon({
        iconUrl: item.primaryFile.tileImageUrl,
        iconSize: [40, 40],
        className: 'rounded-lg border-slate-900 border drop-shadow-2xl'
    });

    const navigateToMap = () => navigate({
        to: '/map',
        search: {
            latitude: item.latitude,
            longitude: item.longitude
        }
    });

    return (
        <div className='flex-auto mt-5'>
            <div className=''>
                Location
            </div>
            <div className='border h-64 overflow-hidden rounded' onClick={navigateToMap}>
                <MapContainer center={position} zoom={13} scrollWheelZoom={false} zoomControl={false} className='select-none' dragging={false} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={position} icon={markerIcon} />
                </MapContainer>
            </div>
        </div>
    )
};

export default ItemInfoSheet;
