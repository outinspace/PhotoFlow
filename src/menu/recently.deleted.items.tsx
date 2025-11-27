import { useMemo } from 'react';
import { useGallery } from "../api/useGallery";
import ItemGrid from '../gallery/item.grid';
import { TopBar } from '../common/top.bar';


export const RecentlyDeletedItems = () => {
    const { data: gallery } = useGallery();

    // BUG: I don't think this is doing anything now that sorting is in grid.
    const items = useMemo(() => {
        const input = gallery?.deletedItems ?? [];

        return input.sort((a, b) => a.deletedTimeUtc!.localeCompare(b.deletedTimeUtc!));
    }, [gallery?.deletedItems]);

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar title='Recently Deleted' />
            <ItemGrid
                items={items}
                albumId={null}
                disableFilteringSorting
            />
        </div>
    );
}

