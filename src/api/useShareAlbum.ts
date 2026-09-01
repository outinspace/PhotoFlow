import { useMutation } from "@tanstack/react-query";
import { appendOperations, invalidateAfterMutation } from "../storage/mutation.log";
import { publishAlbumShare } from "../storage/sharing";

export const useShareAlbum = () => {
    return useMutation({
        mutationFn: async (albumId: number): Promise<string> => {
            const secret = crypto.randomUUID();

            // The shared copy is written as its own object so anyone with the link
            // can read it without the app or any credentials.
            await publishAlbumShare(albumId, secret);

            appendOperations([{ op: 'album.share', albumId, secret }]);

            return secret;
        },
        onSuccess: invalidateAfterMutation
    });
}
