import { useMutation } from "@tanstack/react-query";
import { appendOperations, invalidateAfterMutation } from "../storage/mutation.log";
import { publishAlbumShare } from "../storage/sharing";

export const useShareAlbum = () => {
    return useMutation({
        // Resolves to a presigned URL for the shared document. The secret is still
        // recorded as a mutation, because that is what marks the album as shared
        // in the app and names the object to delete when unsharing.
        mutationFn: async (albumId: number): Promise<string> => {
            const secret = crypto.randomUUID();

            const documentUrl = await publishAlbumShare(albumId, secret);

            appendOperations([{ op: 'album.share', albumId, secret }]);

            return documentUrl;
        },
        onSuccess: invalidateAfterMutation
    });
}
