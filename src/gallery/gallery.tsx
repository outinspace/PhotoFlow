import React, { useMemo, useState } from 'react';
import ItemGrid from "./item.grid";
import { useGallery } from '../queries';
import { Item } from '../types';
import { getMonth, getYear } from 'date-fns';

const Gallery = () => {
    const { data: gallery } = useGallery();

    const items = gallery?.items ?? [];

    const gridItems = useMemo(() => {
        return items.sort((a, b) => a.captureTime < b.captureTime ? 1 : -1); // Date descending
    }, [gallery?.items]);

    const processingItemsCount = items.filter(i => i.files.some(f => f.lastProcessedTimeUtc === null)).length;

    // TODO: Filter button. Hide filter bar until pressed?
    // TODO: Reset button
    // TODO: Horizontal scroll
    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            {processingItemsCount > 0 && (
                <div className='p-1 bg-sky-100 text-sky-700 flex justify-center'>
                    {`${processingItemsCount} photos/videos are being processed.`}
                </div>
            )}
            <FilterBar items={items} />
            <div className='flex flex-auto overflow-hidden relative'>
                <ItemGrid items={gridItems} />
            </div>
        </div>
    )
};

export default Gallery;

interface FilterState {
    type: null | string;
    sort: 'capture-date' | 'file-size';

    year: null | number;
    month: null | number;
    city: null | string;
    region: null | string;
    device: null | string;
}

const defaultFilterState: FilterState = {
    type: null,
    sort: 'capture-date',
    year: null,
    month: null,
    city: null,
    region: null,
    device: null
};

interface FilterBarProps {
    items: Item[];
    onFilterChange?: (value: FilterState) => any;
}

const FilterBar = ({ items, onFilterChange }: FilterBarProps) => {
    const [filters, setFilters] = useState<FilterState>(defaultFilterState);

    const distinctValues = (selector: (i: Item) => string | null) => {
        const valueMap = items.reduce((distinctValues, item) => {
            distinctValues[selector(item) ?? ''] = true;
            return distinctValues;
        }, {});

        return Object.keys(valueMap)
            .filter(value => !!value)
            .sort((a, b) => a.localeCompare(b));
    }

    const cities = useMemo(() => distinctValues(i => i.city), [items]);
    const regions = useMemo(() => distinctValues(i => i.region), [items]);
    const devices = useMemo(() => distinctValues(i => i.cameraMake && i.cameraModel && `${i.cameraMake} ${i.cameraModel}`), [items]);
    const years = useMemo(() => distinctValues(i => getYear(i.captureTime).toString()), [items]);
    const months = useMemo(() => distinctValues(i => getMonth(i.captureTime).toString()), [items]);

    console.log({ cities, items })

    // <select id='year' className='bg-slate-100 mr-1 rounded'>
    //     <option value='null'>Filter</option>
    //     <option>Favorites</option>
    //     <option>Photos</option>
    //     <option>Videos</option>
    // </select>
    // <select className='bg-slate-100 mr-1 rounded p-1'>
    //     <option value='null'>Date Captured</option>
    //     <option value='null'>File Size</option>
    // </select>
    //
    // More Filters:
    // <select id='year' className='bg-slate-100 mr-1 rounded'>
    //     <option value='null'>Year</option>
    //     <option>2024</option>
    //     <option>2024</option>
    //     <option>2024</option>
    //     <option>2024</option>
    // </select>
    //
    const handleSelect = (filterName: string, value: string) => {
        const newFilters: FilterState = { ...filters };

        newFilters[filterName] = value;

        setFilters(newFilters);
    }

    return (
        <div className='flex bg-white w-dvw'>
            <div className='p-2 overflow-x-auto flex'>
                <select className='bg-slate-100 mr-1 rounded' onChange={e => handleSelect('sort', e.target.value)}>
                    <option value='capture-date'>Sort by Date</option>
                    <option value='file-size'>Sort by Size</option>
                </select>
                <select className='bg-slate-100 mr-1 rounded' onChange={e => handleSelect('type', e.target.value)}>
                    <option value=''>Type</option>
                    <option value='favorites'>Favorites</option>
                    <option value='photos'>Photos</option>
                    <option value='videos'>Videos</option>
                </select>
                <select className='bg-slate-100 mr-1 rounded' onChange={e => handleSelect('city', e.target.value)}>
                    <option value=''>City</option>
                    {cities.map(city => (
                        <option key={city} value={city}>{city}</option>
                    ))}
                </select>
                <select className='bg-slate-100 mr-1 rounded' onChange={e => handleSelect('region', e.target.value)}>
                    <option value=''>Region</option>
                    {regions.map(region => (
                        <option key={region} value={region}>{region}</option>
                    ))}
                </select>
                <select className='bg-slate-100 mr-1 rounded' onChange={e => handleSelect('year', e.target.value)}>
                    <option value=''>Year</option>
                    {years.map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
                <select className='bg-slate-100 mr-1 rounded' onChange={e => handleSelect('month', e.target.value)}>
                    <option value=''>Month</option>
                    {months.map(month => (
                        <option key={month} value={month}>{month}</option>
                    ))}
                </select>
                <select className='bg-slate-100 mr-1 rounded' onChange={e => handleSelect('device', e.target.value)}>
                    <option value=''>Device</option>
                    {devices.map(device => (
                        <option key={device} value={device}>{device}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};

interface DropdownOption {
    value: string;
    displayText: string;
}

interface FilterDropdownProps {
    options: DropdownOption;
    value: null | string;
    onChange: (value: null | string) => any;
}

const FilterDropdown = ({ options, value, onChange }) => {



    return (
        <select className='bg-slate-100 mr-1 rounded'>
            <option value='null'>Filter</option>
            <option>Favorites</option>
            <option>Photos</option>
            <option>Videos</option>
        </select>
    )
}

