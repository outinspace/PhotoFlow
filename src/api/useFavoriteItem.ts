import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../app";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";

export const useFavoriteItem = () => {
    return useMutation({
        mutationFn: async (itemId: number) => {
            await fetchAuthenticatedRoute(`/items/${itemId}/favorite`, {
                method: 'POST'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gallery'] });
        }
    });
}

