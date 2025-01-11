import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Leaflet, { Icon, LatLngExpression } from 'leaflet';
import { useGallery } from '../queries';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useSearch } from '@tanstack/react-router';
import { Item } from '../types';
import ItemPreview from '../gallery/item.preview';

interface SearchParams {
    latitude?: number;
    longitude?: number;
}

const Map = () => {
    const [map, setMap] = useState<Leaflet.Map | null>(null);
    const params: SearchParams = useSearch({ strict: false });

    const [previewItems, setPreviewItems] = useState<Item[]>([]);
    const [selectedItemIndex, setSelectedItemIndex] = useState(0);
    const selectedItem: Item | undefined = previewItems[selectedItemIndex];

    let center: LatLngExpression | undefined = undefined;
    if (params.longitude && params.latitude) {
        center = [params.latitude, params.longitude]
    }

    const { data: gallery } = useGallery();

    const resetPreview = () => {
        setSelectedItemIndex(0);
        setPreviewItems([]);
    }

    useItemMarkers({
        items: gallery?.items ?? null,
        map,
        center,
        onSelectItems: setPreviewItems
    });

    return (
        <div className='flex-auto'>
            <MapContainer
                ref={map => setMap(map)}
                zoom={13}
                scrollWheelZoom={true}
                center={center}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
            </MapContainer>
            {selectedItem && (
                <ItemPreview
                    key={selectedItem.itemId}
                    item={selectedItem}
                    albumId={null}
                    onMovePrevious={() => setSelectedItemIndex(selectedItemIndex === 0 ? selectedItemIndex : selectedItemIndex - 1)}
                    onMoveNext={() => setSelectedItemIndex(selectedItemIndex === previewItems.length - 1 ? selectedItemIndex : selectedItemIndex + 1)}
                    onClose={resetPreview}
                />
            )}
        </div>
    );
};

const markerClusterGroup = Leaflet.markerClusterGroup({
    showCoverageOnHover: false,
    removeOutsideVisibleBounds: true,
    chunkedLoading: true,
    spiderfyOnMaxZoom: false
});

interface MarkerClusterProps {
    items: Item[] | null;
    map: Leaflet.Map | null,
    center?: LatLngExpression;
    onSelectItems: (items: Item[]) => any;
}

const useItemMarkers = ({ items, map, center, onSelectItems }: MarkerClusterProps) => {
    useEffect(() => {
        if (map === null || items === null) {
            return;
        }

        markerClusterGroup.clearLayers();

        items
            .filter(item => item.latitude && item.longitude)
            .forEach((item) =>
                Leaflet
                    .marker([item.latitude ?? 0, item.longitude ?? 0], {
                        icon: new Icon({
                            iconUrl: item.primaryFile.tileImageUrl ?? '',
                            iconSize: [40, 40],
                            className: 'rounded-lg border-slate-900 border drop-shadow-2xl'
                        }),
                        // @ts-ignore
                        item
                    })
                    .addTo(markerClusterGroup)
            );

        if (!center) {
            map.fitBounds(markerClusterGroup.getBounds());
        }

        // add the marker cluster group to the map
        map.addLayer(markerClusterGroup);

        markerClusterGroup.on('click', e => {
            const marker = e.sourceTarget;

            onSelectItems([marker.options.item]);
        });

        markerClusterGroup.on('clusterclick', e => {
            const items = e.sourceTarget.getAllChildMarkers().map(marker => marker.options.item);
            const zoomLevel = map.getZoom();

            if (zoomLevel > 15) {
                onSelectItems(items);
            }
        });
    }, [items, center, map, onSelectItems]);
};

export default Map;
