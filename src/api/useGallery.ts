import { useQuery } from "@tanstack/react-query";
import { Item } from "../types";
import { queryClient } from "../app";
import { addMinutes } from "date-fns";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";
import { computeItemProperties } from "./computeItemProperties";

interface UseGalleryData {
    items: Item[];
    checkpointTimeUtc: string;
}

interface GetGalleryResponse {
    items: Item[];
    originalUrlPrefix: string;
    tileImageUrlPrefix: string;
    previewUrlPrefix: string;
}

export const useGallery = () => useQuery({
    queryKey: ['gallery'],
    staleTime: 0,
    queryFn: async () => {
        // Overlap checkpoints by 5 minutes to avoid clock skew between browser and server
        const newCheckpointUtc = addMinutes(new Date(), -5).toISOString();

        const cachedData = queryClient.getQueryData<UseGalleryData>(['gallery']);
        const cachedCheckpointUtc = cachedData?.checkpointTimeUtc;

        let queryParams = '';
        if (cachedCheckpointUtc) {
            queryParams = `?updatedSinceUtc=${cachedCheckpointUtc}`;
        }

        let res: Response
        try {
            res = await fetchAuthenticatedRoute('/items/gallery' + queryParams);
        } catch (e) {
            // HACK: If the device is offline, return cached data
            return cachedData;
        }

        const body = await res.json();
        const updatedGallery = body as GetGalleryResponse;

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
        for (const item of updatedGallery.items) {
            mergedItemsMap[item.itemId] = item;
        }

        // Invalidate service worker cache for updated items
        if ('caches' in window) {
            const cache = await caches.open('photoflow-images');

            for (const updatedItem of updatedGallery.items) {
                const cachedItem = cachedItemsMap[updatedItem.itemId];
                if (!cachedItem) {
                    continue;
                }

                for (const file of cachedItem.files) {
                    if (file.tileImageUrl) {
                        await cache.delete(file.tileImageUrl);
                    }
                    if (file.previewUrl) {
                        await cache.delete(file.previewUrl);
                    }
                }
            }
        }

        const mergedItems = Object.values(mergedItemsMap);

        // Computed properties
        for (const item of mergedItems) {
            computeItemProperties(
                item,
                updatedGallery.originalUrlPrefix,
                updatedGallery.tileImageUrlPrefix,
                updatedGallery.previewUrlPrefix
            );
        }

        return {
            items: mergedItems,
            checkpointTimeUtc: newCheckpointUtc
        };
    }
});

