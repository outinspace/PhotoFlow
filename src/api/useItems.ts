import { useQuery } from "@tanstack/react-query";
import { Item } from "../types";
import { queryClient } from "../app";
import { addMinutes } from "date-fns";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";
import { computeItemProperties } from "./computeItemProperties";

interface UseItemsData {
    items: Item[];
    checkpointTimeUtc: string;
}

interface GetItemsResponse {
    items: Item[];
    originalUrlPrefix: string;
    tileImageUrlPrefix: string;
    previewUrlPrefix: string;
}

const fetchItems = async () => {
    // Overlap checkpoints by 5 minutes to avoid clock skew between browser and server
    const newCheckpointUtc = addMinutes(new Date(), -5).toISOString();

    const cachedData = queryClient.getQueryData<UseItemsData>(['items']);
    const cachedCheckpointUtc = cachedData?.checkpointTimeUtc;

    let queryParams = '';
    if (cachedCheckpointUtc) {
        queryParams = `?updatedSinceUtc=${cachedCheckpointUtc}`;
    }

    let res: Response
    try {
        res = await fetchAuthenticatedRoute('/items' + queryParams);
    } catch (e) {
        // HACK: If the device is offline, return cached data
        return cachedData;
    }

    const body = await res.json();
    const updatedItems = body as GetItemsResponse;

    // Merge cached and updated items
    const cachedItems = cachedData?.items ?? [];
    const cachedItemsMap: Record<number, Item> = {};
    for (const item of cachedItems) {
        cachedItemsMap[item.itemId] = item;
    }

    const mergedItemsMap: Record<number, Item> = {};
    for (const item of cachedItems) {
        mergedItemsMap[item.itemId] = item;
    }
    for (const item of updatedItems.items) {
        mergedItemsMap[item.itemId] = item;
    }

    // Invalidate service worker cache for updated items
    if ('caches' in window) {
        const cache = await caches.open('photoflow-tile-images');

        for (const updatedItem of updatedItems.items) {
            const cachedItem = cachedItemsMap[updatedItem.itemId];
            if (!cachedItem) {
                continue;
            }

            for (const file of cachedItem.files) {
                if (file.tileImageUrl) {
                    await cache.delete(file.tileImageUrl);
                }
            }
        }
    }

    const mergedItems = Object.values(mergedItemsMap);

    // Computed properties
    for (const item of mergedItems) {
        computeItemProperties(
            item,
            updatedItems.originalUrlPrefix,
            updatedItems.tileImageUrlPrefix,
            updatedItems.previewUrlPrefix
        );
    }

    return {
        items: mergedItems,
        checkpointTimeUtc: newCheckpointUtc
    };
};

// The cache holds every item, deleted ones included, so Recently Deleted reads the same data as
// the rest of the app. Each hook takes one side of that split, and no view sees both.
const selectLibraryItems = (data?: UseItemsData) => data?.items.filter(item => !item.deletedTimeUtc);
const selectDeletedItems = (data?: UseItemsData) => data?.items.filter(item => item.deletedTimeUtc);

const itemsQuery = {
    queryKey: ['items'],
    staleTime: 0,
    queryFn: fetchItems
};

export const useItems = () => useQuery({
    ...itemsQuery,
    select: selectLibraryItems
});

export const useDeletedItems = () => useQuery({
    ...itemsQuery,
    select: selectDeletedItems
});
