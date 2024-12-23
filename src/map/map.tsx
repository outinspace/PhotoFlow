import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Leaflet, { Icon, Marker } from 'leaflet';
import { useGallery } from '../queries';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const Map = () => {
    const mapRef = useRef<Leaflet.Map>();

    const { data: gallery } = useGallery();
    const items = gallery?.items ?? [];

    const itemsWithLocation = useMemo(() =>
        items.filter(item => item.longitude && item.latitude),
        [items]);

    const markers = useMemo(() =>
        itemsWithLocation.map(item => {
            const primaryFile = item.files.find(f => f.contentType.startsWith('image')) ?? item.files[0];
            const tileUrl = primaryFile.tileImageUrl;

            return {
                position: [item.latitude, item.longitude],
                tileUrl: tileUrl
            };
        }),
        [itemsWithLocation]);

    return (
        <div className='flex-auto'>
            <MapContainer ref={mapRef} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MyMarkerCluster markers={markers} map={mapRef.current} />
            </MapContainer>
        </div>
    );
};

const markerClusterGroup = Leaflet.markerClusterGroup({
    showCoverageOnHover: false,
    removeOutsideVisibleBounds: true,
    chunkedLoading: true
});

const MyMarkerCluster = ({ markers, map, onSelectItems }) => {
    if (!map) {
        return;
    }

    useEffect(() => {
        markerClusterGroup.clearLayers();

        markers.forEach(({ position, tileUrl, item }) =>
            Leaflet.marker(position, {
                icon: new Icon({
                    iconUrl: tileUrl,
                    iconSize: [40, 40],
                    className: 'rounded-lg border-slate-900 border drop-shadow-2xl'
                }),
                item
            })
                .addTo(markerClusterGroup)
        );

        // optionally center the map around the markers
        map.fitBounds(markerClusterGroup.getBounds());

        // add the marker cluster group to the map
        map.addLayer(markerClusterGroup);

        markerClusterGroup.on('click', e => {
            const marker = e.sourceTarget;
            console.log({ marker });
            marker.options;

        })
        markerClusterGroup.on('clusterclick', (a) => console.log('map cluster click', a.layer.getAllChildMarkers().length, a))
    }, [markers, map]);

    return null;
};

export default Map;
