import { useMutation } from "@tanstack/react-query";
import { appendOperations, invalidateAfterMutation } from "../storage/mutation.log";

interface UpdateAlbumArgs {
    albumId: number;
    name: string | null;
}

export const useUpdateAlbum = () => {
    return useMutation({
        mutationFn: async ({ albumId, name }: UpdateAlbumArgs) => {
            if (name === null) {
                return;
            }
            appendOperations([{ op: 'album.rename', albumId, name }]);
        },
        onSuccess: invalidateAfterMutation
    });
}
