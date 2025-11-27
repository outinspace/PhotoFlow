import { useMemo, useState } from 'react';
import { Item } from '../types';
import { getMonth, getYear } from 'date-fns';
import { useAlbums } from '../api/useAlbums';

interface FilterState {
    sort: string;
    type: string;
    year: string;
    month: string;
    city: string;
    region: string;
    device: string;
}
const defaultFilterState: FilterState = {
    type: '',
    sort: 'capture-date',
    year: '',
    month: '',
    city: '',
    region: '',
    device: ''
};
interface FilterBarProps {
    items: Item[];
    filters: FilterState;
    setFilters: (value: FilterState) => any;
}

export const FilterBar = ({ items, filters, setFilters }: FilterBarProps) => {
    const distinctValues = (selector: (i: Item) => string | number | null, isNumeric: boolean = false) => {
        const valueMap: Record<string | number, boolean> = items.reduce((distinctValues, item) => {
            const key = selector(item) ?? '';
            distinctValues[key] = true;
            return distinctValues;
        }, {} as Record<string | number, boolean>);

        return Object.keys(valueMap)
            .filter(value => !!value)
            .map(value => isNumeric ? parseInt(value) : value)
            .sort((a, b) => {
                if (typeof (a) === 'number' && typeof (b) === 'number') {
                    return a - b;
                } else if (typeof (a) === 'string' && typeof (b) === 'string') {
                    return a.localeCompare(b);
                } else {
                    throw new Error('Bad sort value');
                }
            });
    };

    const cities = useMemo(() => distinctValues(i => i.city), [items]);
    const regions = useMemo(() => distinctValues(i => i.region), [items]);
    const devices = useMemo(() => distinctValues(i => i.device), [items]);
    const years = useMemo(() => distinctValues(i => getYear(i.captureTime), true), [items]);
    const months = useMemo(() => distinctValues(i => getMonth(i.captureTime), true), [items]);

    const handleSelect = (filtersToUpdate: Partial<FilterState>) => {
        const newFilters: FilterState = { ...filters, ...filtersToUpdate };

        setFilters(newFilters);
    };

    const selectClasses = 'bg-slate-100 mr-2 p-1 rounded';

    return (
        <div className='flex max-w-[100dvw] bg-white text-slate-900 items-center border-t border-slate-200'>
            <div className='pl-3 py-2 overflow-x-auto flex flex-shrink'>
                <select className={selectClasses} onChange={e => handleSelect({ type: e.target.value })}>
                    <option value=''>All Items</option>
                    <option value='favorites'>Favorites</option>
                    <option value='photos'>Photos</option>
                    <option value='videos'>Videos</option>
                    <option value='live-photos'>Live Photos</option>
                    <option value='unsorted'>Unsorted</option>
                </select>
                <select className={selectClasses} onChange={e => handleSelect({ sort: e.target.value })}>
                    <option value='capture-date'>Sort by Capture Date</option>
                    <option value='upload-date'>Sort by Upload Date</option>
                    <option value='file-size'>Sort by Size</option>
                    <option value='random'>Sort Randomly</option>
                </select>
                <select className={selectClasses} onChange={e => handleSelect({ city: e.target.value })}>
                    <option value=''>City</option>
                    {cities.map(city => (
                        <option key={city} value={city}>{city.toString().substring(0, 20)}</option>
                    ))}
                </select>
                <select className={selectClasses} onChange={e => handleSelect({ region: e.target.value })}>
                    <option value=''>Region</option>
                    {regions.map(region => (
                        <option key={region} value={region}>{region}</option>
                    ))}
                </select>
                <select className={selectClasses} onChange={e => handleSelect({ year: e.target.value })}>
                    <option value=''>Year</option>
                    {years.map(year => (
                        <option key={year} value={year}>{year ?? 'Unknown'}</option>
                    ))}
                </select>
                <select className={selectClasses} onChange={e => handleSelect({ month: e.target.value })}>
                    <option value=''>Month</option>
                    {months.map(month => (
                        <option key={month} value={month}>{monthNames[month as number] ?? 'Unknown'}</option>
                    ))}
                </select>
                <select className={selectClasses} onChange={e => handleSelect({ device: e.target.value })}>
                    <option value=''>Device</option>
                    {devices.map(device => (
                        <option key={device} value={device}>{device.toString().substr(0, 20)}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};

const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];

// Clean up this hook ai!
export const useFilterBar = (items: Item[]) => {
    const [filters, setFilters] = useState<FilterState>(defaultFilterState);

    const { data: albums } = useAlbums();

    const sortedItems = useMemo(() => {
        const itemIds = (albums ?? []).flatMap(a => a.itemIds);

        return new Set(itemIds);
    }, [albums]);

    const filteredItems = useMemo(() => {
        let tempItems = [...items];

        const today = new Date().toDateString();
        const seedHash = today.split('').reduce((hash, char) => {
            return ((hash << 5) - hash + char.charCodeAt(0)) & 0xffffffff;
        }, 0);
        
        const seededRandom = (seed: number) => {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        };

        tempItems.sort((a, b) => {
            if (filters.sort === 'capture-date') {
                return b.captureTime.localeCompare(a.captureTime);
            } else if (filters.sort === 'upload-date') {
                return b.primaryFile.uploadTimeUtc.localeCompare(a.primaryFile.uploadTimeUtc);
            } else if (filters.sort === 'file-size') {
                return b.totalBytes - a.totalBytes;
            } else if (filters.sort === 'random') {
                const seedA = seedHash + a.itemId;
                const seedB = seedHash + b.itemId;
                return seededRandom(seedA) - seededRandom(seedB);
            } else {
                throw new Error('Unknown sort');
            }
        });

        tempItems = tempItems
            .filter(item => !filters.city || filters.city === item.city)
            .filter(item => !filters.region || filters.region === item.region)
            .filter(item => !filters.device || filters.device === item.device)
            .filter(item => !filters.year || filters.year === getYear(item.captureTime).toString())
            .filter(item => !filters.month || filters.month === getMonth(item.captureTime).toString())
            .filter(item => {
                if (filters.type === 'photos') {
                    return item.type === 'photo';
                } else if (filters.type === 'videos') {
                    return item.type === 'video';
                } else if (filters.type === 'live-photos') {
                    return item.type === 'live-photo';
                } else if (filters.type === 'unsorted') {
                    return !sortedItems.has(item.itemId);
                } else if (filters.type === 'favorites') {
                    return item.isFavorite;
                } else {
                    return true;
                }
            });

        return tempItems;
    }, [items, filters, sortedItems]);

    return {
        filterProps: {
            filters,
            setFilters
        },
        filteredItems,
        resetFilters: () => {
            setFilters(defaultFilterState);
        }

    };
};
