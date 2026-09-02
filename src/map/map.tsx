import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { GeoJSONSource, LngLatBounds, Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSearch } from '@tanstack/react-router';
import { useItems } from '../api/useItems';
import { Item } from '../types';
import { BottomSheet } from '../common/bottom.sheet';
import ItemGrid from '../gallery/item.grid';
import { BASEMAP_STYLE, DOT_COLOR, DOT_STROKE, LABEL_FONT } from './basemap';

// 25,000 geotagged photos is well past what per-marker DOM elements can carry, so
// the points live in a single GeoJSON source and MapLibre clusters and draws them on
// the GPU. Nothing here scales with the number of photos except the source data.

interface SearchParams {
    latitude?: number;
    longitude?: number;
}

const SOURCE_ID = 'photos';
const CLUSTER_LAYER = 'photo-clusters';
const CLUSTER_COUNT_LAYER = 'photo-cluster-counts';
const POINT_LAYER = 'photo-points';

// Above this zoom individual photos separate out instead of staying grouped.
const CLUSTER_MAX_ZOOM = 15;
const CLUSTER_RADIUS = 60;

// A cluster can hold thousands of photos; the sheet only needs enough to browse.
const MAX_ITEMS_PER_CLUSTER = 500;

// Zooming out past this leaves the globe as a marble in a large empty space, so it
// is the floor rather than something to correct after the fact. fitBounds respects
// it too, which is what keeps the initial framing sensible for a worldwide library.
const MIN_ZOOM = 1.4;

const hasValidLocation = (item: Item) =>
    item.latitude != null && item.longitude != null &&
    Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180;

const toFeatureCollection = (items: Item[]): GeoJSON.FeatureCollection => ({
    type: 'FeatureCollection',
    features: items.filter(hasValidLocation).map(item => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [item.longitude!, item.latitude!] },
        // Only the id travels into the source; the item itself stays in the React
        // cache, so the map never holds a second copy of the library.
        properties: { itemId: item.itemId }
    }))
});

const Map = () => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const [ready, setReady] = useState(false);
    const [previewItems, setPreviewItems] = useState<Item[]>([]);

    const params: SearchParams = useSearch({ strict: false });
    const { data: items } = useItems();

    // globalThis.Map because this module's own component is called Map.
    const itemsById = useMemo(
        () => new globalThis.Map((items ?? []).map(item => [item.itemId, item])),
        [items]
    );

    const geojson = useMemo(() => toFeatureCollection(items ?? []), [items]);

    const resolveItems = useCallback(
        (itemIds: number[]) => itemIds.map(id => itemsById.get(id)).filter((i): i is Item => !!i),
        [itemsById]
    );

    // --- create the map once -------------------------------------------------
    useEffect(() => {
        if (!containerRef.current || mapRef.current) {
            return;
        }

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: BASEMAP_STYLE,
            center: [params.longitude ?? 0, params.latitude ?? 20],
            zoom: params.longitude != null ? 12 : 1.4,
            attributionControl: { compact: true },
            minZoom: MIN_ZOOM,
            // Keeps the globe from tumbling to an angle the labels cannot be read at.
            maxPitch: 60
        });

        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
        map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), 'top-right');

        // 'style.load' rather than 'load': the latter also waits for the first
        // screenful of tiles, so the photo layers would not exist until the network
        // came back — and never at all if the map is offscreen and not rendering.
        map.on('style.load', () => setReady(true));

        // The map measures its container once, at construction, and the flex layout
        // around it is not necessarily settled by then — which leaves the canvas
        // stuck at whatever size it saw first. Watching the element keeps the two
        // in step, here and on any later layout change.
        const observer = new ResizeObserver(() => map.resize());
        observer.observe(containerRef.current);

        mapRef.current = map;

        return () => {
            observer.disconnect();
            map.remove();
            mapRef.current = null;
            setReady(false);
        };
    }, []);

    // --- data and layers -----------------------------------------------------
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready) {
            return;
        }

        const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        if (existing) {
            existing.setData(geojson);
            return;
        }

        map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: geojson,
            cluster: true,
            clusterMaxZoom: CLUSTER_MAX_ZOOM,
            clusterRadius: CLUSTER_RADIUS
        });

        map.addLayer({
            id: CLUSTER_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['has', 'point_count'],
            paint: {
                // Interpolated rather than stepped, so a cluster's size changes
                // continuously as photos merge into it instead of jumping.
                'circle-radius': [
                    'interpolate', ['linear'], ['get', 'point_count'],
                    2, 16,
                    25, 22,
                    250, 30,
                    2500, 40
                ],
                'circle-color': DOT_COLOR,
                'circle-opacity': 0.9,
                'circle-stroke-width': 3,
                'circle-stroke-color': DOT_STROKE,
                'circle-stroke-opacity': 0.9,
                'circle-pitch-alignment': 'map'
            }
        });

        map.addLayer({
            id: CLUSTER_COUNT_LAYER,
            type: 'symbol',
            source: SOURCE_ID,
            filter: ['has', 'point_count'],
            layout: {
                'text-field': ['get', 'point_count_abbreviated'],
                'text-font': LABEL_FONT,
                'text-size': [
                    'interpolate', ['linear'], ['get', 'point_count'],
                    2, 12,
                    250, 14,
                    2500, 16
                ],
                'text-allow-overlap': true
            },
            paint: { 'text-color': '#ffffff' }
        });

        map.addLayer({
            id: POINT_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 5, 16, 8],
                'circle-color': DOT_COLOR,
                'circle-opacity': 0.95,
                'circle-stroke-width': 2,
                'circle-stroke-color': DOT_STROKE,
                'circle-pitch-alignment': 'map'
            }
        });
    }, [ready, geojson]);

    // --- frame the photos ----------------------------------------------------
    const hasFramed = useRef(false);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready || hasFramed.current || geojson.features.length === 0) {
            return;
        }

        // A location in the URL means the user came from a specific photo, and
        // framing the whole library would throw that away.
        if (params.longitude != null && params.latitude != null) {
            hasFramed.current = true;
            return;
        }

        const bounds = new LngLatBounds();
        for (const feature of geojson.features) {
            bounds.extend((feature.geometry as GeoJSON.Point).coordinates as [number, number]);
        }

        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
        hasFramed.current = true;
    }, [ready, geojson, params.latitude, params.longitude]);

    // --- interaction ---------------------------------------------------------
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready) {
            return;
        }

        const openCluster = (event: maplibregl.MapLayerMouseEvent) => {
            const feature = event.features?.[0];
            const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
            if (!feature || !source) {
                return;
            }

            source
                .getClusterLeaves(feature.properties.cluster_id, MAX_ITEMS_PER_CLUSTER, 0)
                .then(leaves => {
                    setPreviewItems(resolveItems(leaves.map(leaf => leaf.properties?.itemId)));
                })
                .catch(() => undefined);
        };

        const openPoint = (event: maplibregl.MapLayerMouseEvent) => {
            const itemId = event.features?.[0]?.properties?.itemId;
            if (itemId != null) {
                setPreviewItems(resolveItems([itemId]));
            }
        };

        const showPointer = () => { map.getCanvas().style.cursor = 'pointer'; };
        const hidePointer = () => { map.getCanvas().style.cursor = ''; };

        map.on('click', CLUSTER_LAYER, openCluster);
        map.on('click', POINT_LAYER, openPoint);

        for (const layer of [CLUSTER_LAYER, POINT_LAYER]) {
            map.on('mouseenter', layer, showPointer);
            map.on('mouseleave', layer, hidePointer);
        }

        return () => {
            map.off('click', CLUSTER_LAYER, openCluster);
            map.off('click', POINT_LAYER, openPoint);

            for (const layer of [CLUSTER_LAYER, POINT_LAYER]) {
                map.off('mouseenter', layer, showPointer);
                map.off('mouseleave', layer, hidePointer);
            }
        };
    }, [ready, resolveItems]);

    // --- projection ----------------------------------------------------------
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready) {
            return;
        }

        // The same Mercator tiles are reprojected on the GPU, so the globe costs no
        // extra data. MapLibre flattens towards Mercator on its own as you zoom in,
        // which is why street level still looks like a street map.
        map.setProjection({ type: 'globe' });
    }, [ready]);

    return (
        <div className='relative flex-auto'>
            {/* Sized rather than positioned: maplibre-gl.css sets
                .maplibregl-map { position: relative } and is imported after Tailwind,
                so an `absolute inset-0` container silently collapses to zero height. */}
            <div ref={containerRef} className='size-full bg-slate-900' />

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

export default Map;
