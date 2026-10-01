import { useMemo } from 'react';
import { useItems } from '../api/useItems';
import { parseISO, getYear } from 'date-fns';
import { ItemStack } from './item.stack';
import { useNavigate } from '@tanstack/react-router';
import { type Item } from '../types';
import { CardRow, Section } from './section';
import { pluralize } from '../common/format.helpers';

export const Years = () => {
    const { data: items } = useItems();
    const navigate = useNavigate();

    const itemsByYear = useMemo(() => {
        if (!items) return {};

        const grouped: Record<number, Item[]> = {};

        for (const item of items) {
            const year = getYear(parseISO(item.captureTime));
            if (!grouped[year]) {
                grouped[year] = [];
            }
            grouped[year].push(item);
        }

        return grouped;
    }, [items]);

    const years = useMemo(() => {
        return Object.keys(itemsByYear)
            .map(Number)
            .sort((a, b) => b - a); // Sort years descending (newest first)
    }, [itemsByYear]);

    const handleYearClick = (year: number) => {
        navigate({ to: '/year/$year', params: { year: year.toString() } });
    };

    if (years.length === 0) {
        return null;
    }

    return (
        <Section title='Years'>
            <CardRow>
                {years.map(year => (
                    <div key={year} className='snap-start'>
                        <ItemStack
                            items={itemsByYear[year]}
                            onClick={() => handleYearClick(year)}
                            width='220px'
                            title={year.toString()}
                            subtitle={pluralize(itemsByYear[year].length, 'photo')}
                        />
                    </div>
                ))}
            </CardRow>
        </Section>
    );
};
