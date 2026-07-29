import { useMemo, useState } from 'react';
import { Item } from '../types';
import { getMonth, getYear } from 'date-fns';
import { useAlbums } from '../api/useAlbums';
import { BottomSheet } from '../common/bottom.sheet';

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

export const countActiveFilters = (filters: FilterState): number => {
    let count = 0;
    if (filters.type !== '') count++;
    if (filters.sort !== 'capture-date') count++;
    if (filters.year !== '') count++;
    if (filters.month !== '') count++;
    if (filters.city !== '') count++;
    if (filters.region !== '') count++;
    if (filters.device !== '') count++;
    return count;
};
interface FilterControlsProps {
    items: Item[];
    filters: FilterState;
    setFilters: (value: FilterState) => any;
}

export const FilterControls = ({ items, filters, setFilters }: FilterControlsProps) => {
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

    return (
        <div className='flex flex-col gap-2'>
            <select 
                className='bg-white border border-slate-200 rounded-lg p-2 text-slate-900' 
                value={filters.type}
                onChange={e => handleSelect({ type: e.target.value })}
            >
                <option value=''>All Items</option>
                <option value='favorites'>Favorites</option>
                <option value='photos'>Photos</option>
                <option value='videos'>Videos</option>
                <option value='live-photos'>Live Photos</option>
                <option value='unsorted'>Unsorted</option>
            </select>
            <select 
                className='bg-white border border-slate-200 rounded-lg p-2 text-slate-900' 
                value={filters.sort}
                onChange={e => handleSelect({ sort: e.target.value })}
            >
                <option value='capture-date'>Sort by Capture Date</option>
                <option value='upload-date'>Sort by Upload Date</option>
                <option value='file-size'>Sort by File Size</option>
                <option value='random'>Sort by Random</option>
            </select>
            <select 
                className='bg-white border border-slate-200 rounded-lg p-2 text-slate-900' 
                value={filters.year}
                onChange={e => handleSelect({ year: e.target.value })}
            >
                <option value=''>All Years</option>
                {years.map(year => (
                    <option key={year} value={year}>{year ?? 'Unknown'}</option>
                ))}
            </select>
            <select 
                className='bg-white border border-slate-200 rounded-lg p-2 text-slate-900' 
                value={filters.month}
                onChange={e => handleSelect({ month: e.target.value })}
            >
                <option value=''>All Months</option>
                {months.map(month => (
                    <option key={month} value={month}>{monthNames[month as number] ?? 'Unknown'}</option>
                ))}
            </select>
            <select 
                className='bg-white border border-slate-200 rounded-lg p-2 text-slate-900' 
                value={filters.city}
                onChange={e => handleSelect({ city: e.target.value })}
            >
                <option value=''>All Cities</option>
                {cities.map(city => (
                    <option key={city} value={city}>{city.toString().substring(0, 20)}</option>
                ))}
            </select>
            <select 
                className='bg-white border border-slate-200 rounded-lg p-2 text-slate-900' 
                value={filters.region}
                onChange={e => handleSelect({ region: e.target.value })}
            >
                <option value=''>All Regions</option>
                {regions.map(region => (
                    <option key={region} value={region}>{region}</option>
                ))}
            </select>
            <select 
                className='bg-white border border-slate-200 rounded-lg p-2 text-slate-900' 
                value={filters.device}
                onChange={e => handleSelect({ device: e.target.value })}
            >
                <option value=''>All Devices</option>
                {devices.map(device => (
                    <option key={device} value={device}>{device.toString().substr(0, 20)}</option>
                ))}
            </select>
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

interface FilterSheetProps {
    items: Item[];
    filters: FilterState;
    setFilters: (value: FilterState) => any;
    isOpen: boolean;
    onDismiss: () => any;
}

export const FilterSheet = ({ items, filters, setFilters, isOpen, onDismiss }: FilterSheetProps) => {
    const activeFilterCount = countActiveFilters(filters);
    const handleReset = () => {
        setFilters(defaultFilterState);
    };

    return (
        <BottomSheet isOpen={isOpen} onDismiss={onDismiss}>
            <div className='flex flex-col'>
                <h2 className='text-xl font-bold text-slate-900 mb-3'>Filters</h2>
                <FilterControls items={items} filters={filters} setFilters={setFilters} />
                {activeFilterCount > 0 && (
                    <button
                        onClick={handleReset}
                        className='mt-4 py-2 px-4 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-900 font-medium rounded-lg transition-colors'
                    >
                        Reset Filters
                    </button>
                )}
            </div>
        </BottomSheet>
    );
};

export const useFilterBar = (items: Item[]) => {
    const [filters, setFilters] = useState<FilterState>(defaultFilterState);

    const { data: albums } = useAlbums();

    // Backs the 'unsorted' filter: an item counts as sorted once it is in some album.
    const itemIdsInAlbums = useMemo(() => {
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
                    return !itemIdsInAlbums.has(item.itemId);
                } else if (filters.type === 'favorites') {
                    return item.isFavorite;
                } else {
                    return true;
                }
            });

        return tempItems;
    }, [items, filters, itemIdsInAlbums]);

    return {
        filterProps: {
            filters,
            setFilters
        },
        filteredItems
    };
};
