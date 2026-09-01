import { useMutation } from "@tanstack/react-query";
import { appendOperations, invalidateAfterMutation } from "../storage/mutation.log";

interface AlbumItemIds {
    albumId: number;
    itemIds: number[];
}

export const useRemoveItemsFromAlbum = () => {
    return useMutation({
        mutationFn: async ({ albumId, itemIds }: AlbumItemIds) => {
            appendOperations(itemIds.map(itemId => ({ op: 'album.member' as const, albumId, itemId, value: false })));
        },
        onSuccess: invalidateAfterMutation
    });
}
