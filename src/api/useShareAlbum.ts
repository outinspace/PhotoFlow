import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../app";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";

export const useShareAlbum = () => {
    return useMutation({
        mutationFn: async (albumId: number): Promise<string> => {
            const res = await fetchAuthenticatedRoute(`/album/share/${albumId}`, {
                method: 'POST'
            });

            const shareSecret = await res.json();

            return shareSecret as string;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['albums'] });
        }
    });
}

