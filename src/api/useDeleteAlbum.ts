import { useMutation } from "@tanstack/react-query";
import { appendOperations, invalidateAfterMutation } from "../storage/mutation.log";

export const useDeleteAlbum = () => {
    return useMutation({
        mutationFn: async (albumId: number) => {
            appendOperations([{ op: 'album.delete', albumId }]);
        },
        onSuccess: invalidateAfterMutation
    });
}
