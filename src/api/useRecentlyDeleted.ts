import { useQuery } from "@tanstack/react-query";
import { Item } from "../types";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";
import { computeItemProperties } from "./computeItemProperties";

interface GetGalleryResponse {
    items: Item[];
    originalUrlPrefix: string;
    tileImageUrlPrefix: string;
    previewUrlPrefix: string;
}

export const useRecentlyDeleted = () =>
    useQuery({
        queryKey: ["gallery", "recently-deleted"],
        staleTime: 0,
        queryFn: async () => {
            const res = await fetchAuthenticatedRoute("/items/recently-deleted");
            const body = (await res.json()) as GetGalleryResponse;
            for (const item of body.items) {
                computeItemProperties(
                    item,
                    body.originalUrlPrefix,
                    body.tileImageUrlPrefix,
                    body.previewUrlPrefix
                );
            }
            return { items: body.items };
        },
    });
