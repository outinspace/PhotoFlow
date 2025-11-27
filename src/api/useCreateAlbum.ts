import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../app";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";

interface CreateAlbumArgs {
    name: string;
    itemIds: number[];
}

export const useCreateAlbum = () => {
    return useMutation({
        mutationFn: async ({ name, itemIds }: CreateAlbumArgs): Promise<number | null> => {
            const res = await fetchAuthenticatedRoute('/album', {
                method: 'POST',
                body: JSON.stringify({ name, itemIds }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (res.ok) {
                const body = await res.json();
                return body.albumId;
            } else {
                return null;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['albums'] });
        }
    });
}

