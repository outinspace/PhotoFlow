import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Leaflet, { Icon, LatLngExpression } from 'leaflet';
import { useGallery } from '../api/useGallery';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useSearch } from '@tanstack/react-router';
import { Item } from '../types';
import { BottomSheet } from '../common/bottom.sheet';
import ItemGrid from '../gallery/item.grid';

interface SearchParams {
    latitude?: number;
    longitude?: number;
}

const Map = () => {
    const [map, setMap] = useState<Leaflet.Map | null>(null);
    const params: SearchParams = useSearch({ strict: false });
    const [previewItems, setPreviewItems] = useState<Item[]>([]);

    // Memoised so the markers aren't rebuilt on every render by a new array identity.
    const center = useMemo<LatLngExpression | undefined>(() => {
        if (params.longitude && params.latitude) {
            return [params.latitude, params.longitude];
        }
    }, [params.latitude, params.longitude]);

    const { data: gallery } = useGallery();

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
            <BottomSheet
                isOpen={previewItems.length > 0}
                onDismiss={() => setPreviewItems([])}
            >
                <div className='flex flex-grow rounded-lg overflow-hidden'>
                    {/* The sheet has its own drag-to-dismiss gesture, which grid pinches
                        would contend with. */}
                    <ItemGrid items={previewItems} albumId={null} disablePinch />
                </div>
            </BottomSheet>
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
            // Ignore missing coordinates
            .filter(item => item.latitude && item.longitude)
            // Ignore invalid coordinates
            .filter(item => Math.abs(item.latitude ?? 0) <= 90)
            .filter(item => Math.abs(item.longitude ?? 0) <= 180)
            .forEach((item) =>
                Leaflet
                    .marker([item.latitude ?? 0, item.longitude ?? 0], {
                        icon: item.primaryFile.tileImageUrl ? (
                            new Icon({
                                iconUrl: item.primaryFile.tileImageUrl ?? '',
                                iconSize: [40, 40],
                                className: 'rounded-lg border-slate-900 border drop-shadow-2xl'
                            })
                        ) : undefined,
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
    }, [items, center, map]);

    // markerClusterGroup outlives this component, so its listeners have to be removed
    // again — otherwise they stack up and each click fires onSelectItems repeatedly.
    useEffect(() => {
        const handleMarkerClick = (e: any) => {
            onSelectItems([e.sourceTarget.options.item]);
        };

        const handleClusterClick = (e: any) => {
            onSelectItems(e.sourceTarget.getAllChildMarkers().map((marker: any) => marker.options.item));
        };

        markerClusterGroup.on('click', handleMarkerClick);
        markerClusterGroup.on('clusterclick', handleClusterClick);

        return () => {
            markerClusterGroup.off('click', handleMarkerClick);
            markerClusterGroup.off('clusterclick', handleClusterClick);
        };
    }, [onSelectItems]);
};

export default Map;
