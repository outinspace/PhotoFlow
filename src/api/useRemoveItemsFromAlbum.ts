import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../app";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";

interface AlbumItemIds {
    albumId: number;
    itemIds: number[];
}

export const useRemoveItemsFromAlbum = () => {
    return useMutation({
        mutationFn: async ({ albumId, itemIds }: AlbumItemIds) => {
            await fetchAuthenticatedRoute(`/album/${albumId}/items`, {
                method: 'DELETE',
                body: JSON.stringify(itemIds),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['albums'] });
        }
    });
}

