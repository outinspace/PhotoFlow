import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../app";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";

interface CreateAlbumArgs {
    name: string;
    itemIds: number[];
}

export const useCreateAlbum = () => {
    return useMutation({
        mutationFn: async ({ name, itemIds }: CreateAlbumArgs): Promise<number> => {
            const res = await fetchAuthenticatedRoute('/album', {
                method: 'POST',
                body: JSON.stringify({ name, itemIds }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const body = await res.json();
            return body.albumId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['albums'] });
        }
    });
}

