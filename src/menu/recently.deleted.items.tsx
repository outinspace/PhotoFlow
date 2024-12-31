import React, { useMemo } from 'react';
import { useGallery } from "../queries";
import ItemGrid from '../gallery/item.grid';
import PageHeader from '../common/page.header';


export const RecentlyDeletedItems = () => {
    const { data: gallery } = useGallery();

    const items = useMemo(() => {
        const input = gallery?.deletedItems ?? [];

        return input.sort((a, b) => a.deletedTimeUtc!.localeCompare(b.deletedTimeUtc!));
    }, [gallery?.deletedItems]);

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <div className='p-5'>
                <PageHeader name='Recently Deleted' />
            </div>
            <ItemGrid items={items} />
        </div>
    );
}

