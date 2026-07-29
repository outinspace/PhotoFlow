import { useMemo } from 'react';
import { useTrips } from '../api/useTrips';
import { parseISO } from 'date-fns';
import ItemGrid from '../gallery/item.grid';
import { TopBar } from '../common/top.bar';
import { useParams } from '@tanstack/react-router';

export const TripLayout = () => {
    const { tripId } = useParams({ from: '/trip/$tripId' });
    const trips = useTrips();

    const trip = useMemo(() => {
        return trips.find(t => t.tripId === tripId);
    }, [trips, tripId]);

    const tripItems = useMemo(() => {
        if (!trip) return [];

        return trip.items
            .sort((a, b) => {
                const dateA = parseISO(a.captureTime).getTime();
                const dateB = parseISO(b.captureTime).getTime();
                return dateB - dateA;
            });
    }, [trip]);

    if (!trip) {
        return null;
    }

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar
                title={trip.name}
            />
            <ItemGrid items={tripItems} albumId={null} enableUrlPersistence />
        </div>
    );
};

