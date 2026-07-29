import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../app";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";

export const useDeleteAlbum = () => {
    return useMutation({
        mutationFn: async (albumId: number) => {
            await fetchAuthenticatedRoute(`/album/${albumId}`, {
                method: 'DELETE',
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

