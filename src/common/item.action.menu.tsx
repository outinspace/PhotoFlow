import React, { useEffect, useRef } from 'react';
import { Item } from '../types';
import { Download } from 'iconoir-react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import { formatBytes } from './format.helpers';

interface Props {
    item: Item;
    isOpen: boolean;
    onDismiss: () => any;
}

const ItemActionMenu = ({ item, isOpen, onDismiss }: Props) => {
    console.log(item);

    if (!isOpen) {
        return;
    }

    return (
        <div
            className='left-0 right-0 top-0 bottom-0 fixed bg-slate-900/50 z-10 max-height-dvh bordered flex flex-col justify-end'
        >
            <div
                className='flex-auto min-h-20'
                onClick={() => onDismiss()}
            />
            <div
                className='bg-slate-50 rounded-t-lg overflow-y-auto z-10 p-3 flex-initial pb-9'
            >
                <div className='absolute left-0 right-0 -m-7 absolute flex flex-col items-center pointer-events-none'>
                    <div className='w-10 h-2 bg-slate-50 rounded-full'></div>
                </div>

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
                        <div className='flex-auto p-2 truncate text-ellipsis'>
                            {file.originalFileName}
                        </div>
                        <div className='border-l border-slate-50 p-2 flex-none'>
                            {getFileExtension(file.originalFileName)}
                        </div>
                        <div className='border-l border-slate-50 p-2 flex-none'>
                            {formatBytes(file.sizeBytes)}
                        </div>
                        <div className='border-l border-slate-50 p-2 flex-none hover:bg-slate-200 rounded-r'>
                            <Download onClick={() => open(file.originalUrl)} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

function getFileExtension(fileName: string) {
    const segments = fileName.split('.');
    const extension = '.' + segments.slice(-1);
    return extension;
}

const LocationMetadata = ({ item }: { item: Item }) => {
    const positionAvailable = false && item.latitude && item.longitude;

    const position: LatLngExpression = [item.latitude ?? 0, item.longitude ?? 0];

    return (
        <div className='flex-auto mt-5'>
            <div className=''>
                Location
            </div>
            <div className='border h-24'>
                {positionAvailable && (
                    <MapContainer center={position} zoom={13} scrollWheelZoom={false}>
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                    // <Marker position={position}>
                    //     <Popup>
                    //         A pretty CSS3 popup. <br /> Easily customizable.
                    //     </Popup>
                    // </Marker>
                    </MapContainer>
                )}
            </div>
        </div>
    )
};

export default ItemActionMenu;
