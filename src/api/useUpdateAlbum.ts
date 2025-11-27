import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../app";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";

interface UpdateAlbumArgs {
    albumId: number;
    name: string | null;
}

export const useUpdateAlbum = () => {
    return useMutation({
        mutationFn: async ({ albumId, name }: UpdateAlbumArgs): Promise<boolean> => {
            const res = await fetchAuthenticatedRoute(`/album/${albumId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    name
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return res.ok;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['albums'] });
        }
    });
}

