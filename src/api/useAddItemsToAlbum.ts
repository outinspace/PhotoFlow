import { useMutation } from "@tanstack/react-query";
import { appendOperations, invalidateAfterMutation } from "../storage/mutation.log";

interface AlbumItemIds {
    albumId: number;
    itemIds: number[];
}

export const useAddItemsToAlbum = () => {
    return useMutation({
        mutationFn: async ({ albumId, itemIds }: AlbumItemIds) => {
            appendOperations(itemIds.map(itemId => ({ op: 'album.member' as const, albumId, itemId, value: true })));
        },
        onSuccess: invalidateAfterMutation
    });
}
