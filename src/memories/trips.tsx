import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { useTrips } from '../api/useTrips';
import { ItemStack } from './item.stack';
import { useNavigate } from '@tanstack/react-router';
import { CardRow, Section } from './section';
import { formatDateRange, pluralize } from '../common/format.helpers';

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
        <Section title='Trips'>
            <CardRow>
                {tripsToShow.map(trip => (
                    <div key={trip.tripId} className='snap-start'>
                        <ItemStack
                            items={trip.items}
                            onClick={() => handleTripClick(trip.tripId)}
                            width='min(300px, 78vw)'
                            aspectRatio='4/5'
                            title={trip.city || trip.region || trip.name}
                            subtitle={`${formatDateRange(parseISO(trip.startDate), parseISO(trip.endDate))} · ${pluralize(trip.items.length, 'photo')}`}
                        />
                    </div>
                ))}
            </CardRow>
        </Section>
    );
};
