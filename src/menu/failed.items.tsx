import { useMemo } from 'react';
import { useItems } from "../api/useItems";
import ItemGrid from '../gallery/item.grid';
import { TopBar } from '../common/top.bar';


export const FailedItems = () => {
    const { data } = useItems();

    const items = useMemo(() => {
        const input = data ?? [];

        return input.filter(item => item.files.some(file => !!file.failedProcessingTimeUtc));
    }, [data]);

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar title='Failed Items' />
            <ItemGrid items={items} albumId={null} />
        </div>
    );
}
