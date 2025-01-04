import React from 'react';
import ItemGrid from "./item.grid";
import { useGallery } from '../queries';
import { useFilterBar, FilterBar } from './filter.bar';

const Gallery = () => {
    const { data: gallery } = useGallery();

    const items = gallery?.items ?? [];

    const { filterProps, filteredItems } = useFilterBar(items);

    // TODO: Filter button. Hide filter bar until pressed?
    // TODO: Reset button
    // TODO: Horizontal scroll

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <FilterBar {...filterProps} items={items} />
            <ItemGrid items={filteredItems} />
        </div>
    )
};

export default Gallery;
