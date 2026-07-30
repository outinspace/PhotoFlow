import { useMemo } from 'react';
import { useItems } from '../api/useItems';
import { parseISO, getYear } from 'date-fns';
import { ItemStack } from './item.stack';
import { useNavigate } from '@tanstack/react-router';
import { type Item } from '../types';

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
        <>
            <div className="mb-6">
                <h2 className="text-2xl font-bold mb-4 px-6">Years</h2>
                <div className="overflow-x-auto" style={{ maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
                    <div className="flex shrink-1 gap-4 pl-6" style={{ width: 'max-content' }}>
                        {years.map((year) => {
                            const yearItems = itemsByYear[year];
                            return (
                                <div key={year} className="flex flex-col items-center flex-shrink-0">
                                    <ItemStack
                                        items={yearItems}
                                        onClick={() => handleYearClick(year)}
                                    />
                                    <div className="mt-2 text-sm font-medium">{year}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
};

