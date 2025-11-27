import { useQuery } from "@tanstack/react-query";
import { Item } from "../types";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";
import { computeItemProperties } from "./computeItemProperties";

interface GetPublicItemResponse {
    item: Item;
    originalUrlPrefix: string;
    tileImageUrlPrefix: string;
    previewUrlPrefix: string;
}

export const usePublicItem = (tenantId: string, primaryFileId: string) => useQuery({
    queryKey: ['public', 'item', tenantId, primaryFileId],
    queryFn: async () => {
        const res = await fetchAuthenticatedRoute(`/public/item/${tenantId}/${primaryFileId}`);

        const body = await res.json();
        const response = body as GetPublicItemResponse;

        // Computed properties
        computeItemProperties(
            response.item,
            response.originalUrlPrefix,
            response.tileImageUrlPrefix,
            response.previewUrlPrefix
        );

        return response.item;
    }
});

