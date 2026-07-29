import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGallery } from "./useGallery";
import { Item } from "../types";
import { parseISO, format } from "date-fns";

// What clustering produces and what gets cached. It holds item ids rather than the items
// themselves, so the cached copy stays small and can't go stale against the gallery.
interface DetectedTrip {
    tripId: string;
    name: string;
    itemIds: number[];
    startDate: string;
    endDate: string;
    city: string | null;
    region: string | null;
}

export interface Trip extends Omit<DetectedTrip, 'itemIds'> {
    items: Item[];
}

const STALE_TIME_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const CLUSTERING_TIME_WINDOW_HOURS = 7 * 24; // 1 week
const MAX_TRIP_DURATION_HOURS = 3 * 30 * 24; // 3 months
const MIN_TRIP_PHOTOS = 20;
const MAX_TRIP_PHOTOS = 1000;
const GRID_CELL_SIZE = 0.5; // degrees (≈ 55km at equator)

interface GridCell {
    lat: number;
    lon: number;
    items: Item[];
    minTime: number;
    maxTime: number;
}

interface LocationKey {
    city: string | null;
    region: string | null;
}

const getLocationKey = (item: Item): LocationKey => ({
    city: item.city,
    region: item.region
});

const getGridCell = (lat: number, lon: number): { lat: number; lon: number } => {
    return {
        lat: Math.floor(lat / GRID_CELL_SIZE) * GRID_CELL_SIZE,
        lon: Math.floor(lon / GRID_CELL_SIZE) * GRID_CELL_SIZE
    };
};

const getGridCellKey = (cell: { lat: number; lon: number }): string => {
    return `${cell.lat},${cell.lon}`;
};

const areCellsAdjacent = (cell1: { lat: number; lon: number }, cell2: { lat: number; lon: number }): boolean => {
    const latDiff = Math.abs(cell1.lat - cell2.lat);
    const lonDiff = Math.abs(cell1.lon - cell2.lon);
    return latDiff <= GRID_CELL_SIZE && lonDiff <= GRID_CELL_SIZE && (latDiff > 0 || lonDiff > 0);
};

const generateTripId = (firstItem: Item): string => {
    const hash = `${firstItem.itemId}-${firstItem.captureTime}`;
    return hash.split('').reduce((acc, char) => {
        const hash = ((acc << 5) - acc) + char.charCodeAt(0);
        return hash & hash;
    }, 0).toString(36);
};

const formatTripName = (trip: { city: string | null; region: string | null; startDate: string; endDate: string }): string => {
    const start = parseISO(trip.startDate);
    const end = parseISO(trip.endDate);
    
    const locationName = trip.city || trip.region || 'Unknown Location';
    
    if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
        return `${locationName} - ${format(start, 'MMM d, yyyy')}`;
    }
    
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
        return `${locationName} - ${format(start, 'MMM d')}-${format(end, 'd, yyyy')}`;
    }
    
    if (start.getFullYear() === end.getFullYear()) {
        return `${locationName} - ${format(start, 'MMM d')}-${format(end, 'MMM d, yyyy')}`;
    }
    
    return `${locationName} - ${format(start, 'MMM d, yyyy')}-${format(end, 'MMM d, yyyy')}`;
};

const detectTrips = (items: Item[]): DetectedTrip[] => {
    // Filter items with geographic coordinates
    const itemsWithCoords = items.filter(item =>
        item.latitude !== null && item.longitude !== null
    );

    if (itemsWithCoords.length === 0) {
        return [];
    }

    // Step 1: Group items by grid cell (O(n))
    const gridCells = new Map<string, GridCell>();
    
    for (const item of itemsWithCoords) {
        const cell = getGridCell(item.latitude!, item.longitude!);
        const cellKey = getGridCellKey(cell);
        const itemTime = parseISO(item.captureTime).getTime();
        
        if (!gridCells.has(cellKey)) {
            gridCells.set(cellKey, {
                lat: cell.lat,
                lon: cell.lon,
                items: [],
                minTime: itemTime,
                maxTime: itemTime
            });
        }
        
        const gridCell = gridCells.get(cellKey)!;
        gridCell.items.push(item);
        gridCell.minTime = Math.min(gridCell.minTime, itemTime);
        gridCell.maxTime = Math.max(gridCell.maxTime, itemTime);
    }
    
    // Step 2: Merge adjacent cells within time window
    const cellGroups: GridCell[][] = [];
    const processedCells = new Set<string>();
    
    for (const [cellKey, cell] of gridCells.entries()) {
        if (processedCells.has(cellKey)) {
            continue;
        }
        
        // Start a new group with this cell
        const group: GridCell[] = [cell];
        processedCells.add(cellKey);
        
        // Track the merged group's time window
        let groupMinTime = cell.minTime;
        let groupMaxTime = cell.maxTime;
        
        // Find all adjacent cells within time window
        const queue: GridCell[] = [cell];
        
        while (queue.length > 0) {
            const currentCell = queue.shift()!;
            
            for (const [otherKey, otherCell] of gridCells.entries()) {
                if (processedCells.has(otherKey)) {
                    continue;
                }
                
                if (areCellsAdjacent(
                    { lat: currentCell.lat, lon: currentCell.lon },
                    { lat: otherCell.lat, lon: otherCell.lon }
                )) {
                    // Check if time windows are within clustering window (1 week)
                    const timeGap = Math.min(
                        Math.abs(groupMaxTime - otherCell.minTime),
                        Math.abs(otherCell.maxTime - groupMinTime)
                    );
                    const timeGapHours = timeGap / (1000 * 60 * 60);
                    
                    // Only merge if the gap between time windows is less than 1 week
                    if (timeGapHours < CLUSTERING_TIME_WINDOW_HOURS) {
                        const mergedMinTime = Math.min(groupMinTime, otherCell.minTime);
                        const mergedMaxTime = Math.max(groupMaxTime, otherCell.maxTime);
                        group.push(otherCell);
                        processedCells.add(otherKey);
                        queue.push(otherCell);
                        // Update group time window
                        groupMinTime = mergedMinTime;
                        groupMaxTime = mergedMaxTime;
                    }
                }
            }
        }
        
        cellGroups.push(group);
    }
    
    // Step 3: Convert cell groups to trips
    const getPrimaryLocation = (tripItems: Item[]): LocationKey => {
        const locationCounts = new Map<string, { count: number; location: LocationKey }>();
        
        for (const item of tripItems) {
            const key = getLocationKey(item);
            const keyString = `${key.city || ''}|${key.region || ''}`;
            
            if (key.city || key.region) {
                const existing = locationCounts.get(keyString);
                if (existing) {
                    existing.count++;
                } else {
                    locationCounts.set(keyString, { count: 1, location: key });
                }
            }
        }
        
        if (locationCounts.size === 0) {
            return { city: null, region: null };
        }
        
        let maxCount = 0;
        let primaryLocation: LocationKey = { city: null, region: null };
        
        for (const { count, location } of locationCounts.values()) {
            if (count > maxCount) {
                maxCount = count;
                primaryLocation = location;
            }
        }
        
        return primaryLocation;
    };
    
    const trips: DetectedTrip[] = [];

    for (const group of cellGroups) {
        // Combine all items from cells in this group
        const groupItems: Item[] = [];
        let minTime = Infinity;
        let maxTime = -Infinity;
        
        for (const cell of group) {
            groupItems.push(...cell.items);
            minTime = Math.min(minTime, cell.minTime);
            maxTime = Math.max(maxTime, cell.maxTime);
        }
        
        // Sort items by time
        groupItems.sort((a, b) => a.captureTime.localeCompare(b.captureTime));
        
        // Calculate trip duration
        const tripDurationHours = (maxTime - minTime) / (1000 * 60 * 60);
        
        // Filter by size and duration
        if (groupItems.length < MIN_TRIP_PHOTOS) {
            continue;
        }
        if (groupItems.length > MAX_TRIP_PHOTOS) {
            continue;
        }
        if (tripDurationHours > MAX_TRIP_DURATION_HOURS) {
            continue;
        }
        
        const primaryLocation = getPrimaryLocation(groupItems);
        const startDate = new Date(minTime).toISOString();
        const endDate = new Date(maxTime).toISOString();
        
        trips.push({
            tripId: generateTripId(groupItems[0]),
            name: formatTripName({
                city: primaryLocation.city,
                region: primaryLocation.region,
                startDate,
                endDate
            }),
            itemIds: groupItems.map(item => item.itemId),
            startDate,
            endDate,
            city: primaryLocation.city,
            region: primaryLocation.region
        });
    }
    
    return trips.sort((a, b) => b.startDate.localeCompare(a.startDate));
};

export const useTrips = (): Trip[] => {
    const { data: gallery } = useGallery();

    // Clustering walks the whole gallery, so it runs at most once a week rather than on
    // every visit to Memories. The key is deliberately constant — keying it on the item
    // count, as this once did, both missed changes that kept the count the same and left
    // a separate cache entry behind for every count the gallery ever had.
    // The trade-off is that photos added since the last run won't join a trip until the
    // week is up.
    const { data: detectedTrips } = useQuery({
        queryKey: ['trips'],
        staleTime: STALE_TIME_MS,
        enabled: !!gallery,
        queryFn: () => gallery ? detectTrips(gallery.items) : []
    });

    // Only the grouping is cached, so the items themselves are always the current ones
    // from the gallery. Anything deleted since the last run drops out here.
    return useMemo(() => {
        if (!detectedTrips || !gallery) {
            return [];
        }

        const itemsById = new Map(gallery.items.map(item => [item.itemId, item]));

        return detectedTrips.map(trip => ({
            ...trip,
            items: trip.itemIds.flatMap(itemId => itemsById.get(itemId) ?? [])
        }));
    }, [detectedTrips, gallery]);
};

