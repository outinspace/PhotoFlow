import { useMutation } from "@tanstack/react-query";
import { appendOperations, invalidateAfterMutation } from "../storage/mutation.log";
import { newAlbumId } from "../storage/mutations";

interface CreateAlbumArgs {
    name: string;
    itemIds: number[];
}

export const useCreateAlbum = () => {
    return useMutation({
        mutationFn: async ({ name, itemIds }: CreateAlbumArgs): Promise<number> => {
            const albumId = newAlbumId();

            appendOperations([
                { op: 'album.create', albumId, name },
                ...itemIds.map(itemId => ({ op: 'album.member' as const, albumId, itemId, value: true }))
            ]);

            return albumId;
        },
        onSuccess: invalidateAfterMutation
    });
}
