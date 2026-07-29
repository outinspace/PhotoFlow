import { useMemo } from 'react';
import { useTrips } from '../api/useTrips';
import { ItemStack } from './item.stack';
import { useNavigate } from '@tanstack/react-router';

export const Trips = () => {
    const trips = useTrips();
    const navigate = useNavigate();

    const tripsToShow = useMemo(() => {
        return trips.filter(trip => trip.items.length > 0);
    }, [trips]);

    const handleTripClick = (tripId: string) => {
        navigate({ to: '/trip/$tripId', params: { tripId } });
    };

    if (tripsToShow.length === 0) {
        return null;
    }

    return (
        <>
            <div className="mb-6">
                <h2 className="text-2xl font-bold mb-4 px-6">Trips</h2>
                <div className="overflow-x-auto" style={{ maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
                    <div className="flex shrink-1 gap-4 pl-6" style={{ width: 'max-content' }}>
                        {tripsToShow.map((trip) => {
                            return (
                                <div key={trip.tripId} className="flex flex-col items-center flex-shrink-0">
                                    <ItemStack
                                        items={trip.items}
                                        onClick={() => handleTripClick(trip.tripId)}
                                    />
                                    <div className="mt-2 text-sm font-medium text-center max-w-[300px]">
                                        {trip.name}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
};

