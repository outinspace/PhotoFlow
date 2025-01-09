import React, { useMemo } from 'react';
import { useGallery } from "../queries";
import ItemGrid from '../gallery/item.grid';
import { TopBar } from '../common/top.bar';


export const ItemsInProcess = () => {
    const { data: gallery } = useGallery();

    const items = useMemo(() => {
        const input = gallery?.items ?? [];

        return input.filter(item => item.files.some(file => file.lastProcessedTimeUtc === null));
    }, [gallery?.items]);

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar title='Items In-Process' />
            <ItemGrid items={items} />
        </div>
    );
}

