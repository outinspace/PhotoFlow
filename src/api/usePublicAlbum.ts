import { useQuery } from "@tanstack/react-query";
import { Item } from "../types";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";
import { computeItemProperties } from "./computeItemProperties";

interface GetPublicAlbumResponse {
    name: string;
    createdTimeUtc: string;
    updatedTimeUtc: string;
    items: Item[];
    originalUrlPrefix: string;
    tileImageUrlPrefix: string;
    previewUrlPrefix: string;
}

export const usePublicAlbum = (tenantId: string, shareSecret: string) => useQuery({
    queryKey: ['public', 'album', tenantId, shareSecret],
    queryFn: async () => {
        const res = await fetchAuthenticatedRoute(`/public/album/${tenantId}/${shareSecret}`);

        const body = await res.json();
        const response = body as GetPublicAlbumResponse;

        // Computed properties
        for (const item of response.items) {
            computeItemProperties(
                item,
                response.originalUrlPrefix,
                response.tileImageUrlPrefix,
                response.previewUrlPrefix
            );
        }

        return response;
    }
});

