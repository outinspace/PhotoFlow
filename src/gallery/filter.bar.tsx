import { useCallback, useEffect, useMemo, useState } from 'react';
import { animated, useTransition } from '@react-spring/web';
import { Item } from '../types';
import { getMonth, getYear } from 'date-fns';
import { Check, NavArrowLeft, NavArrowRight } from 'iconoir-react';
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

// The filters live in the URL under their own names, so a refresh, a bookmark or a
// shared link opens the same view — the same reason the anchor item is there. Only
// what differs from the default is written, so an unfiltered gallery keeps a clean
// address.
const filterNames = Object.keys(defaultFilterState) as (keyof FilterState)[];

const readFilters = (): FilterState => {
    const params = new URLSearchParams(window.location.search);

    const filters = { ...defaultFilterState };
    for (const name of filterNames) {
        filters[name] = params.get(name) ?? defaultFilterState[name];
    }

    return filters;
};

const writeFilters = (filters: FilterState) => {
    const url = new URL(window.location.href);

    for (const name of filterNames) {
        if (filters[name] === defaultFilterState[name]) {
            url.searchParams.delete(name);
        } else {
            url.searchParams.set(name, filters[name]);
        }
    }

    // Replaced rather than pushed: a filter is a change of view, not a place, and
    // pushing would put every dropdown touch between the gallery and the back button.
    window.history.replaceState({}, '', url.toString());
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

interface FilterOption {
    value: string;
    label: string;
}

interface Facet {
    key: keyof FilterState;
    label: string;
    options: FilterOption[];
}

// Year, month, city, region and device are whatever the items themselves carry, so
// the menu never offers a filter that would empty the grid.
const useFacets = (items: Item[]): Facet[] => {
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

    return useMemo(() => [
        {
            key: 'type', label: 'Show', options: [
                { value: '', label: 'All Items' },
                { value: 'favorites', label: 'Favorites' },
                { value: 'photos', label: 'Photos' },
                { value: 'videos', label: 'Videos' },
                { value: 'live-photos', label: 'Live Photos' },
                { value: 'unsorted', label: 'Unsorted' }
            ]
        },
        {
            key: 'sort', label: 'Sort by', options: [
                { value: 'capture-date', label: 'Capture Date' },
                { value: 'capture-date-asc', label: 'Capture Date (Oldest First)' },
                { value: 'upload-date', label: 'Upload Date' },
                { value: 'file-size', label: 'File Size' },
                { value: 'random', label: 'Random' }
            ]
        },
        {
            key: 'year', label: 'Year', options: [
                { value: '', label: 'All Years' },
                ...years.map(year => ({ value: year.toString(), label: year.toString() }))
            ]
        },
        {
            key: 'month', label: 'Month', options: [
                { value: '', label: 'All Months' },
                ...months.map(month => ({ value: month.toString(), label: monthNames[month as number] ?? 'Unknown' }))
            ]
        },
        {
            key: 'city', label: 'City', options: [
                { value: '', label: 'All Cities' },
                ...cities.map(city => ({ value: city.toString(), label: city.toString().substring(0, 20) }))
            ]
        },
        {
            key: 'region', label: 'Region', options: [
                { value: '', label: 'All Regions' },
                ...regions.map(region => ({ value: region.toString(), label: region.toString() }))
            ]
        },
        {
            key: 'device', label: 'Device', options: [
                { value: '', label: 'All Devices' },
                ...devices.map(device => ({ value: device.toString(), label: device.toString().substring(0, 20) }))
            ]
        }
    ], [years, months, cities, regions, devices]);
};

interface FilterMenuProps {
    items: Item[];
    filters: FilterState;
    setFilters: (value: FilterState) => any;
    isOpen: boolean;
    onDismiss: () => any;
}

// One anchored menu that drills down a level at a time: the top level lists each
// filter with the value it currently holds, and picking a row swaps the panel for
// that filter's values. Anchored rather than a sheet so the grid stays visible
// behind it, and so the same thing happens on a phone and on a desktop.
export const FilterMenu = ({ items, filters, setFilters, isOpen, onDismiss }: FilterMenuProps) => {
    const facets = useFacets(items);
    const [openFacetKey, setOpenFacetKey] = useState<keyof FilterState | null>(null);
    const openFacet = facets.find(facet => facet.key === openFacetKey);
    const activeFilterCount = countActiveFilters(filters);

    // Closing leaves the panel where it was, so reset it — otherwise the next open
    // lands inside whichever filter was touched last.
    useEffect(() => {
        if (!isOpen) {
            setOpenFacetKey(null);
        }
    }, [isOpen]);

    const menuTransitions = useTransition(isOpen, {
        from: {
            y: 20,
            opacity: 0
        },
        enter: {
            y: 0,
            opacity: 1
        },
        leave: {
            y: 20,
            opacity: 0
        },
        config: { tension: 500 }
    });

    const shadowTransitions = useTransition(isOpen, {
        from: {
            opacity: 0
        },
        enter: {
            opacity: 1
        },
        leave: {
            opacity: 0
        },
        config: { tension: 500 }
    });

    const rowClasses = 'border-b last:border-none border-slate-200 px-3 py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 flex items-center gap-2 cursor-pointer';

    const handleSelect = (key: keyof FilterState, value: string) => {
        setFilters({ ...filters, [key]: value });
        setOpenFacetKey(null);
    };

    return (
        <>
            {shadowTransitions((styles, state) => state && (
                <animated.div
                    className='fixed bg-black/50 top-0 bottom-0 left-0 right-0 z-20'
                    style={{
                        width: '10000px',
                        height: '10000px',
                        marginLeft: '-5000px',
                        marginTop: '-5000px',
                        ...styles
                    }}
                    onClick={() => onDismiss()}
                />
            ))}
            {menuTransitions((styles, state) => state && (
                <animated.div
                    className='absolute left-0 bottom-0 z-20 my-12 w-72 max-h-[60vh] overflow-y-auto rounded-lg drop-shadow text-black'
                    style={styles}
                >
                    {!openFacet && (
                        <>
                            {facets.map(facet => {
                                const selected = facet.options.find(option => option.value === filters[facet.key]);

                                return (
                                    <div
                                        key={facet.key}
                                        className={rowClasses}
                                        onClick={() => setOpenFacetKey(facet.key)}
                                    >
                                        <span className='shrink-0'>{facet.label}</span>
                                        <span className={`flex-auto min-w-0 text-right truncate ${filters[facet.key] === facet.options[0].value ? 'text-slate-500' : 'text-sky-600'}`}>
                                            {selected?.label ?? facet.options[0].label}
                                        </span>
                                        <NavArrowRight className='size-4 text-slate-400' />
                                    </div>
                                );
                            })}
                            {activeFilterCount > 0 && (
                                <div
                                    className={`${rowClasses} font-medium`}
                                    onClick={() => {
                                        setFilters(defaultFilterState);
                                        onDismiss();
                                    }}
                                >
                                    Reset Filters
                                </div>
                            )}
                        </>
                    )}
                    {openFacet && (
                        <div className='filter-panel-in'>
                            <div
                                className={`${rowClasses} gap-1 font-semibold bg-slate-100`}
                                onClick={() => setOpenFacetKey(null)}
                            >
                                <NavArrowLeft className='size-4 text-slate-500' />
                                {openFacet.label}
                            </div>
                            {openFacet.options.map(option => (
                                <div
                                    key={option.value}
                                    className={rowClasses}
                                    onClick={() => handleSelect(openFacet.key, option.value)}
                                >
                                    <span className='flex-auto'>{option.label}</span>
                                    {filters[openFacet.key] === option.value && (
                                        <Check className='size-5 text-sky-600' />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </animated.div>
            ))}
        </>
    );
};

export const useFilterBar = (items: Item[], enableUrlPersistence: boolean) => {
    const [filters, setStoredFilters] = useState<FilterState>(() =>
        enableUrlPersistence ? readFilters() : defaultFilterState
    );

    const setFilters = useCallback((value: FilterState) => {
        setStoredFilters(value);

        if (enableUrlPersistence) {
            writeFilters(value);
        }
    }, [enableUrlPersistence]);

    // Opening a photo pushes a history entry, so back and forward can land on a URL
    // whose filters are not the ones on screen. Follow the URL, as the open photo does.
    useEffect(() => {
        if (!enableUrlPersistence) return;

        const handlePopState = () => setStoredFilters(readFilters());

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [enableUrlPersistence]);

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
            if (filters.sort === 'capture-date' || filters.sort === 'capture-date-asc') {
                // Items nothing knew the date of go last rather than into the
                // timeline under the upload time standing in for it — in both
                // directions. Sorting by upload date is how you go and look at them.
                if (a.hasCaptureDate !== b.hasCaptureDate) {
                    return a.hasCaptureDate ? -1 : 1;
                }

                const newestFirst = b.captureTime.localeCompare(a.captureTime);
                return filters.sort === 'capture-date' ? newestFirst : -newestFirst;
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
