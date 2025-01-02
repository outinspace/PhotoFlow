import React from 'react';
import { Item } from '../types';
import { Download, MediaImage, MediaVideo } from 'iconoir-react';
import { Icon, LatLngExpression } from 'leaflet';
import { formatBytes } from './format.helpers';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { useNavigate } from '@tanstack/react-router';

interface Props {
    item: Item;
    isOpen: boolean;
    onDismiss: () => any;
}

const ItemActionMenu = ({ item, isOpen, onDismiss }: Props) => {
    console.log(item);


    // TODO: Escape keybinding

    if (!isOpen) {
        return;
    }

    return (
        <div
            className='left-0 right-0 top-0 bottom-0 fixed bg-slate-900/60 z-10 max-height-dvh bordered flex flex-col md:flex-row justify-end'
        >
            <div
                className='flex-auto min-h-20'
                onClick={() => onDismiss()}
            >
            </div>
            <div
                className='bg-slate-50 rounded-t-lg md:rounded-none md:rounded-l-lg md:max-w-96 overflow-y-auto z-10 p-3 flex-initial pb-9'
            >
                <CameraMetadata item={item} />
                <FileMetadata item={item} />
                <LocationMetadata item={item} />
            </div>
        </div>
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
                                <MediaVideo className='size-6' />
                            ) : (
                                <MediaImage className='size-6' />
                            )}
                        </div>
                        <div className='border-l border-slate-50 flex-auto p-2 truncate text-ellipsis'>
                            {file.originalFileName}
                        </div>
                        <div className='border-l border-slate-50 p-2 flex-none'>
                            {formatBytes(file.sizeBytes)}
                        </div>
                        <div className='border-l border-slate-50 p-2 flex-none hover:bg-slate-200 rounded-r'>
                            <Download onClick={() => downloadAndShare(file.originalUrl, file.originalFileName)} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

async function downloadAndShare(uri: string, name: string) {
    // @ts-ignore
    if (navigator.share) {
        const res = await fetch(uri);
        if (!res.ok) {
            throw new Error('Failed to fetch');
        }

        const blob = await res.blob();
        const file = new File([blob], name, { type: blob.type });

        await navigator.share({
            title: name,
            files: [file]
        });
    } else {
        var link = document.createElement("a");
        link.download = name;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

const LocationMetadata = ({ item }: { item: Item }) => {
    const navigate = useNavigate();
    const positionAvailable = item.latitude && item.longitude;

    if (!positionAvailable) {
        return;
    }

    const position: LatLngExpression = [item.latitude ?? 0, item.longitude ?? 0];

    const primaryFile = item.files.find(f => f.contentType.startsWith('image')) ?? item.files[0];
    const tileUrl = primaryFile.tileImageUrl;

    const markerIcon = new Icon({
        iconUrl: tileUrl ?? '',
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

export default ItemActionMenu;
