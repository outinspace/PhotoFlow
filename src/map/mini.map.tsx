import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { BASEMAP_STYLE, DOT_COLOR, DOT_STROKE } from './basemap';

// A single location, not interactive: the info sheet has its own drag gesture, and a
// pannable map inside it would fight for the same touches. Tapping it opens the real
// map instead.
export const MiniMap = ({ latitude, longitude }: { latitude: number; longitude: number }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: BASEMAP_STYLE,
            center: [longitude, latitude],
            zoom: 12,
            interactive: false,
            attributionControl: false
        });

        map.on('load', () => {
            map.addSource('pin', {
                type: 'geojson',
                data: { type: 'Point', coordinates: [longitude, latitude] }
            });

            map.addLayer({
                id: 'pin',
                type: 'circle',
                source: 'pin',
                paint: {
                    'circle-radius': 7,
                    'circle-color': DOT_COLOR,
                    'circle-stroke-width': 3,
                    'circle-stroke-color': DOT_STROKE
                }
            });
        });

        return () => map.remove();
    }, [latitude, longitude]);

    return <div ref={containerRef} className='size-full' />;
};
