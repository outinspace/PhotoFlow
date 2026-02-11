import { useMemo } from "react";
import { useRecentlyDeleted } from "../api/useRecentlyDeleted";
import ItemGrid from "../gallery/item.grid";
import { TopBar } from "../common/top.bar";

export const RecentlyDeletedItems = () => {
    const { data } = useRecentlyDeleted();

    const items = useMemo(
        () =>
            (data?.items ?? []).sort((a, b) =>
                (b.deletedTimeUtc ?? "").localeCompare(a.deletedTimeUtc ?? "")
            ),
        [data?.items]
    );

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

