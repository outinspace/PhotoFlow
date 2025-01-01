import React from 'react';
import ItemGrid from "./item.grid";
import { useGallery } from '../queries';
import { useFilterBar, FilterBar } from './filter.bar';

const Gallery = () => {
    const { data: gallery } = useGallery();

    const items = gallery?.items ?? [];

    // const gridItems = useMemo(() => {
    //     return items.sort((a, b) => a.captureTime < b.captureTime ? 1 : -1); // Date descending
    // }, [gallery?.items]);

    const processingItemsCount = items.filter(i => i.files.some(f => f.lastProcessedTimeUtc === null)).length;

    const { filterProps, filteredItems } = useFilterBar(items);

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
            <FilterBar {...filterProps} items={items} />
            <ItemGrid items={filteredItems} />
        </div>
    )
};

export default Gallery;
