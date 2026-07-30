import { useMemo } from "react";
import { subDays } from "date-fns";
import { useDeletedItems } from "../api/useItems";
import ItemGrid from "../gallery/item.grid";
import { TopBar } from "../common/top.bar";

const RECENTLY_DELETED_DAYS = 30;

export const RecentlyDeletedItems = () => {
    const { data } = useDeletedItems();

    const items = useMemo(() => {
        const cutoff = subDays(new Date(), RECENTLY_DELETED_DAYS);

        return (data ?? [])
            .filter(item => new Date(item.deletedTimeUtc!) >= cutoff)
            .sort((a, b) => b.deletedTimeUtc!.localeCompare(a.deletedTimeUtc!));
    }, [data]);

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
