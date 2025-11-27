import { useMemo } from 'react';
import { useGallery } from '../api/useGallery';
import { parseISO, getYear } from 'date-fns';
import ItemGrid from '../gallery/item.grid';
import { TopBar } from '../common/top.bar';
import { useParams } from '@tanstack/react-router';

export const YearLayout = () => {
    const { year } = useParams({ from: '/year/$year' });
    const yearNumber = parseInt(year);
    
    if (isNaN(yearNumber)) {
        throw new Error('Invalid year');
    }

    const { data: gallery } = useGallery();

    const yearItems = useMemo(() => {
        if (!gallery?.items) return [];

        return gallery.items
            .filter(item => {
                const itemYear = getYear(parseISO(item.captureTime));
                return itemYear === yearNumber;
            })
            .sort((a, b) => {
                const dateA = parseISO(a.captureTime).getTime();
                const dateB = parseISO(b.captureTime).getTime();
                return dateB - dateA;
            });
    }, [gallery?.items, yearNumber]);

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar
                title={year.toString()}
            />
            <ItemGrid items={yearItems} albumId={null} enableUrlPersistence />
        </div>
    );
};

