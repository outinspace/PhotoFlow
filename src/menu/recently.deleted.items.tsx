import React, { useMemo } from 'react';
import { useGallery } from "../queries";
import ItemGrid from '../gallery/item.grid';
import PageHeader from '../common/page.header';
import { TopBar } from '../common/top.bar';


export const RecentlyDeletedItems = () => {
    const { data: gallery } = useGallery();

    const items = useMemo(() => {
        const input = gallery?.deletedItems ?? [];

        return input.sort((a, b) => a.deletedTimeUtc!.localeCompare(b.deletedTimeUtc!));
    }, [gallery?.deletedItems]);

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar title='Recently Deleted' />
            <ItemGrid items={items} />
        </div>
    );
}

